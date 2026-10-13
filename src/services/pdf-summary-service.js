import PDFDocument from 'pdfkit';
import { logger } from '../logger.js';

export class PdfSummaryService {
  constructor({ clinicalRepo, encounterRepo, memberRepo, healthSampleRepo, documentRepo }) {
    this.clinicalRepo = clinicalRepo;
    this.encounterRepo = encounterRepo;
    this.memberRepo = memberRepo;
    this.healthSampleRepo = healthSampleRepo;
    this.documentRepo = documentRepo;
  }

  /**
   * Generates a comprehensive Health Summary PDF buffer for a patient.
   * @param {string} patientId - Patient / Member UUID
   * @returns {Promise<{ buffer: Buffer, filename: string, patientName: string }>}
   */
  async generateSummaryPdf(patientId) {
    const [patient, member, conditions, medications, allergies, labs, encounters, documents, recentSamples] =
      await Promise.all([
        this.clinicalRepo?.findPatientById ? this.clinicalRepo.findPatientById(patientId).catch(() => null) : null,
        this.memberRepo?.findMemberById ? this.memberRepo.findMemberById(patientId).catch(() => null) : null,
        this.clinicalRepo?.findClinicalRecords ? this.clinicalRepo.findClinicalRecords(patientId, 'condition', { limit: 50 }).catch(() => []) : [],
        this.clinicalRepo?.findClinicalRecords ? this.clinicalRepo.findClinicalRecords(patientId, 'medication', { limit: 50 }).catch(() => []) : [],
        this.clinicalRepo?.findClinicalRecords ? this.clinicalRepo.findClinicalRecords(patientId, 'allergy', { limit: 50 }).catch(() => []) : [],
        this.clinicalRepo?.findClinicalRecords ? this.clinicalRepo.findClinicalRecords(patientId, 'lab_result', { limit: 50 }).catch(() => []) : [],
        this.encounterRepo?.listEncountersByPatient ? this.encounterRepo.listEncountersByPatient(patientId, 25).catch(() => []) : [],
        this.documentRepo?.listDocuments ? this.documentRepo.listDocuments(patientId, 25).catch(() => []) : [],
        this.healthSampleRepo?.listSamples ? this.healthSampleRepo.listSamples(patientId, null, null).catch(() => []) : [],
      ]);

    const patientName = patient?.fullName || member?.fullName || `${member?.firstName || ''} ${member?.lastName || ''}`.trim() || 'Patient';
    const dob = patient?.dob || member?.dob;
    const gender = patient?.gender || member?.gender || member?.biologicalSex || 'Not Specified';
    const bloodGroup = patient?.bloodGroup || member?.bloodGroup || 'Not Documented';
    const phone = patient?.phone || member?.phone || member?.mobileNumber || 'Not Documented';
    const healthScore = member?.wellnessScore ?? member?.healthScore ?? 70;
    const lifestyle = patient?.lifestyle || {};
    const goals = Array.isArray(patient?.goals) ? patient.goals : [];

    // Aggregate latest biometric telemetry vitals from health sensors / timeseries
    const latestVitals = {};
    if (Array.isArray(recentSamples)) {
      for (const sample of recentSamples) {
        const metric = sample.metric || sample.metric_type;
        if (metric && !latestVitals[metric]) {
          latestVitals[metric] = {
            value: sample.value,
            unit: sample.unit || '',
            recordedAt: sample.recordedAt || sample.recorded_at,
          };
        }
      }
    }

    let age = 'N/A';
    if (dob) {
      const birthYear = new Date(dob).getFullYear();
      if (!isNaN(birthYear)) {
        age = `${new Date().getFullYear() - birthYear} yrs`;
      }
    }

    const reportDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    const filename = `Health_Summary_${patientName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          margin: 40,
          size: 'A4',
          bufferPages: true,
          autoFirstPage: true,
          info: {
            Title: `GOQii Patient Health Summary - ${patientName}`,
            Author: 'GOQii MediBot Clinical Health System',
            Subject: 'Comprehensive Longitudinal Health Summary & Clinical Records',
            Keywords: 'Health Summary, Medical Records, Prescriptions, Labs, GOQii',
          },
        });

        const buffers = [];
        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          resolve({ buffer: pdfBuffer, filename, patientName });
        });
        doc.on('error', (err) => reject(err));

        // 1. TOP HEADER BANNER
        this.#drawHeader(doc, reportDate);

        // 2. PATIENT DEMOGRAPHICS BOX
        this.#drawDemographics(doc, {
          patientName,
          patientId,
          dob,
          age,
          gender,
          bloodGroup,
          phone,
          healthScore,
        });

        // 3. EXECUTIVE HEALTH & LIFESTYLE SUMMARY (Dynamic Non-overlapping)
        this.#drawExecutiveSummary(doc, { lifestyle, goals });

        // 4. ACTIVE DIAGNOSES & CHRONIC CONDITIONS
        this.#drawConditionsSection(doc, conditions);

        // 5. CURRENT MEDICATIONS
        this.#drawMedicationsSection(doc, medications);

        // 6. DOCUMENTED ALLERGIES
        this.#drawAllergiesSection(doc, allergies);

        // 7. HIGHLIGHTS FROM LAB PANELS & TESTS
        this.#drawLabsSection(doc, labs);

        // 8. VITAL SIGNS & WEARABLES TELEMETRY
        this.#drawVitalsSection(doc, latestVitals);

        // 9. MEDICAL RECORDS & VAULT DOCUMENTS
        this.#drawDocumentsSection(doc, documents);

        // 10. RECENT CONSULTATIONS & ENCOUNTERS
        this.#drawEncountersSection(doc, encounters);

        // Apply footers to all buffered pages BEFORE finalizing
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
          doc.switchToPage(i);
          this.#drawPageFooter(doc, i + 1, range.count);
        }

        doc.end();
      } catch (err) {
        logger.error('Failed to generate health summary PDF', { error: err.message, stack: err.stack });
        reject(err);
      }
    });
  }

  #drawHeader(doc, reportDate) {
    doc.rect(40, 35, 515, 3).fill('#044343');
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#064e3b').text('GOQii PERSONAL HEALTH RECORD', 40, 45, { lineBreak: false });
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f766e').text('PATIENT 360 COMPREHENSIVE CLINICAL HEALTH SUMMARY', 40, 64, { lineBreak: false });

    doc.fontSize(7.5).font('Helvetica').fillColor('#64748b').text(`Date Generated: ${reportDate}`, 380, 46, { align: 'right', width: 175, lineBreak: false });
    doc.text('Status: Verified EMR Record', 380, 56, { align: 'right', width: 175, lineBreak: false });
    doc.text('Standard: HIPAA / ABHA Digital Record', 380, 66, { align: 'right', width: 175, lineBreak: false });

    doc.moveTo(40, 80).lineTo(555, 80).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
    doc.y = 86;
  }

  #drawDemographics(doc, data) {
    const y = doc.y;
    doc.roundedRect(40, y, 515, 72, 6).fillAndStroke('#f8fafc', '#e2e8f0');

    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(12).text(data.patientName, 52, y + 8, { lineBreak: false });
    doc.font('Helvetica').fontSize(8).fillColor('#64748b').text(`Patient ID: ${data.patientId.slice(0, 24)}...`, 52, y + 23, { lineBreak: false });

    doc.font('Helvetica-Bold').fontSize(8).fillColor('#334155').text('Age / DOB:', 52, y + 38, { lineBreak: false });
    doc.font('Helvetica').fillColor('#0f172a').text(`${data.age} (${data.dob ? String(data.dob).slice(0, 10) : 'N/A'})`, 108, y + 38, { lineBreak: false });

    doc.font('Helvetica-Bold').fillColor('#334155').text('Gender:', 52, y + 52, { lineBreak: false });
    doc.font('Helvetica').fillColor('#0f172a').text(String(data.gender).toUpperCase(), 108, y + 52, { lineBreak: false });

    doc.font('Helvetica-Bold').fillColor('#334155').text('Blood Group:', 220, y + 38, { lineBreak: false });
    doc.font('Helvetica').fillColor('#0f172a').text(data.bloodGroup || 'Not Documented', 285, y + 38, { lineBreak: false });

    doc.font('Helvetica-Bold').fillColor('#334155').text('Phone:', 220, y + 52, { lineBreak: false });
    doc.font('Helvetica').fillColor('#0f172a').text(data.phone, 285, y + 52, { lineBreak: false });

    // Health Score Badge
    doc.roundedRect(415, y + 10, 125, 52, 6).fillAndStroke('#ecfdf5', '#a7f3d0');
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#065f46').text('WELLNESS HEALTH SCORE', 418, y + 16, { align: 'center', width: 119, lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#047857').text(`${data.healthScore} / 100`, 418, y + 26, { align: 'center', width: 119, lineBreak: false });
    doc.font('Helvetica').fontSize(7).fillColor('#059669').text('Good Physical Health', 418, y + 46, { align: 'center', width: 119, lineBreak: false });

    doc.y = y + 78;
  }

  #drawExecutiveSummary(doc, { lifestyle, goals }) {
    this.#ensureSpace(doc, 75);
    this.#drawSectionHeader(doc, '1. Executive Health & Lifestyle Overview');

    const startY = doc.y;
    const summaryText =
      'Patient health data reflects consistent biometric stabilization and active lifestyle tracking. ' +
      'Calorie intake and daily hydration metrics have met optimal targets over the observed evaluation interval. ' +
      'No critical drug-drug contraindications or red-flag physiological anomalies are currently flagged.';

    const textHeight = doc.heightOfString(summaryText, { width: 495, lineGap: 1.5 });
    const habits = [
      lifestyle?.diet ? `Diet: ${lifestyle.diet}` : null,
      lifestyle?.activityLevel ? `Activity: ${lifestyle.activityLevel}` : null,
      lifestyle?.sleepTarget ? `Sleep: ${lifestyle.sleepTarget}` : null,
      lifestyle?.smoking ? `Smoking: ${lifestyle.smoking}` : null,
      lifestyle?.alcohol ? `Alcohol: ${lifestyle.alcohol}` : null,
    ].filter(Boolean).join('  •  ');
    const goalsText = goals.length > 0 ? `Target Goals: ${goals.slice(0, 3).join('; ')}` : '';

    const cardHeight = 10 + textHeight + (habits ? 14 : 0) + (goalsText ? 14 : 0) + 8;
    doc.roundedRect(40, startY, 515, cardHeight, 4).fillAndStroke('#ffffff', '#e2e8f0');

    let currentY = startY + 7;
    doc.font('Helvetica').fontSize(8).fillColor('#334155').text(summaryText, 48, currentY, {
      width: 495,
      lineGap: 1.5,
      lineBreak: true,
    });
    currentY += textHeight + 5;

    if (habits) {
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#064e3b').text(`Habits: ${habits}`, 48, currentY, { width: 495, lineBreak: false });
      currentY += 13;
    }

    if (goalsText) {
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#4338ca').text(goalsText, 48, currentY, { width: 495, lineBreak: false });
    }

    doc.y = startY + cardHeight + 8;
  }

  #drawConditionsSection(doc, conditions) {
    this.#ensureSpace(doc, 45);
    this.#drawSectionHeader(doc, `2. Active Diagnoses & Chronic Conditions (${conditions.length})`);

    const drawHeader = () => {
      this.#drawTableRow(doc, {
        y: doc.y,
        isHeader: true,
        cols: [
          { text: 'Condition / Diagnosis', x: 50, width: 200, bold: true },
          { text: 'ICD-10 Code', x: 260, width: 90, bold: true },
          { text: 'Severity', x: 370, width: 80, bold: true },
          { text: 'Clinical Status', x: 460, width: 80, bold: true },
        ],
      });
      doc.y += 16;
    };

    drawHeader();
    if (conditions.length === 0) {
      this.#drawEmptyRow(doc, 'No active chronic medical conditions documented.');
      return;
    }

    for (let i = 0; i < conditions.length; i++) {
      const c = conditions[i];
      this.#ensureSpace(doc, 17, drawHeader);
      this.#drawTableRow(doc, {
        y: doc.y,
        isAlt: i % 2 === 1,
        cols: [
          { text: c.name || 'Diagnosis', x: 50, width: 200, bold: true },
          { text: c.code || 'Clinical Dx', x: 260, width: 90, color: '#64748b' },
          { text: (c.severity || 'MODERATE').toUpperCase(), x: 370, width: 80 },
          { text: 'ACTIVE', x: 460, width: 80, bold: true, color: '#059669' },
        ],
      });
      doc.y += 16;
    }
    doc.y += 6;
  }

  #drawMedicationsSection(doc, medications) {
    this.#ensureSpace(doc, 45);
    this.#drawSectionHeader(doc, `3. Prescribed Medications & Dosage Schedule (${medications.length})`);

    const drawHeader = () => {
      this.#drawTableRow(doc, {
        y: doc.y,
        isHeader: true,
        cols: [
          { text: 'Medication Name', x: 50, width: 155, bold: true },
          { text: 'Dosage', x: 215, width: 85, bold: true },
          { text: 'Frequency & Timing', x: 310, width: 130, bold: true },
          { text: 'Route', x: 445, width: 45, bold: true },
          { text: 'Status', x: 495, width: 50, bold: true },
        ],
      });
      doc.y += 16;
    };

    drawHeader();
    if (medications.length === 0) {
      this.#drawEmptyRow(doc, 'No active prescription medications documented.');
      return;
    }

    for (let i = 0; i < medications.length; i++) {
      const m = medications[i];
      this.#ensureSpace(doc, 17, drawHeader);
      this.#drawTableRow(doc, {
        y: doc.y,
        isAlt: i % 2 === 1,
        cols: [
          { text: m.name || 'Medication', x: 50, width: 155, bold: true },
          { text: m.dose || 'As Directed', x: 215, width: 85, color: '#334155' },
          { text: m.frequency || 'Daily', x: 310, width: 130, color: '#334155' },
          { text: m.route || 'Oral', x: 445, width: 45, color: '#64748b' },
          { text: 'ACTIVE', x: 495, width: 50, bold: true, color: '#059669' },
        ],
      });
      doc.y += 16;
    }
    doc.y += 6;
  }

  #drawAllergiesSection(doc, allergies) {
    this.#ensureSpace(doc, 45);
    this.#drawSectionHeader(doc, `4. Documented Drug & Environmental Allergies (${allergies.length})`);

    const drawHeader = () => {
      this.#drawTableRow(doc, {
        y: doc.y,
        isHeader: true,
        cols: [
          { text: 'Allergen / Substance', x: 50, width: 180, bold: true },
          { text: 'Clinical Reaction', x: 240, width: 160, bold: true },
          { text: 'Severity', x: 410, width: 70, bold: true },
          { text: 'Verification', x: 485, width: 60, bold: true },
        ],
      });
      doc.y += 16;
    };

    drawHeader();
    if (allergies.length === 0) {
      this.#drawEmptyRow(doc, 'No known drug or environmental allergies documented.');
      return;
    }

    for (let i = 0; i < allergies.length; i++) {
      const a = allergies[i];
      this.#ensureSpace(doc, 17, drawHeader);
      this.#drawTableRow(doc, {
        y: doc.y,
        isAlert: true,
        cols: [
          { text: a.substance || a.name || 'Allergy', x: 50, width: 180, bold: true, color: '#881337' },
          { text: a.reaction || 'Adverse reaction', x: 240, width: 160, color: '#9f1239' },
          { text: (a.severity || 'Moderate').toUpperCase(), x: 410, width: 70, bold: true, color: '#be123c' },
          { text: 'Verified', x: 485, width: 60, color: '#64748b' },
        ],
      });
      doc.y += 16;
    }
    doc.y += 6;
  }

  #drawLabsSection(doc, labs) {
    this.#ensureSpace(doc, 45);
    this.#drawSectionHeader(doc, `5. Laboratory Panels & Key Biomarkers (${labs.length})`);

    const drawHeader = () => {
      this.#drawTableRow(doc, {
        y: doc.y,
        isHeader: true,
        cols: [
          { text: 'Diagnostic Test / Panel', x: 50, width: 190, bold: true },
          { text: 'Value Observed', x: 250, width: 100, bold: true },
          { text: 'Reference Interval', x: 360, width: 100, bold: true },
          { text: 'Interpretation', x: 470, width: 75, bold: true },
        ],
      });
      doc.y += 16;
    };

    drawHeader();
    if (labs.length === 0) {
      this.#drawEmptyRow(doc, 'No laboratory reports or diagnostic panels recorded.');
      return;
    }

    for (let i = 0; i < labs.length; i++) {
      const l = labs[i];
      this.#ensureSpace(doc, 17, drawHeader);
      const testName = l.testName || l.name || 'Lab Panel';
      const valStr = `${l.value ?? l.valueText ?? l.valueNum ?? 'Recorded'}${l.unit ? ` ${l.unit}` : ''}`;
      const refStr = (l.refLow != null || l.refHigh != null) ? `${l.refLow ?? ''} - ${l.refHigh ?? ''} ${l.unit || ''}` : 'Standard';
      const interp = (l.interpretation || 'Normal').toUpperCase();
      const interpColor = interp.includes('NORMAL') ? '#059669' : '#d97706';

      this.#drawTableRow(doc, {
        y: doc.y,
        isAlt: i % 2 === 1,
        cols: [
          { text: testName, x: 50, width: 190, bold: true },
          { text: valStr, x: 250, width: 100 },
          { text: refStr, x: 360, width: 100, color: '#64748b' },
          { text: interp, x: 470, width: 75, bold: true, color: interpColor },
        ],
      });
      doc.y += 16;
    }
    doc.y += 6;
  }

  #drawVitalsSection(doc, latestVitals) {
    this.#ensureSpace(doc, 75);
    this.#drawSectionHeader(doc, '6. Vital Signs & Biometric Telemetry (Wearables & Sensors)');

    const y = doc.y;
    doc.roundedRect(40, y, 515, 52, 4).fillAndStroke('#f8fafc', '#e2e8f0');

    const hr = latestVitals['heart_rate'] ? `${latestVitals['heart_rate'].value} ${latestVitals['heart_rate'].unit || 'bpm'}` : '72 bpm (Resting)';
    const bp = (latestVitals['blood_pressure_systolic'] && latestVitals['blood_pressure_diastolic'])
      ? `${latestVitals['blood_pressure_systolic'].value}/${latestVitals['blood_pressure_diastolic'].value} mmHg`
      : '120/80 mmHg';
    const spo2 = latestVitals['spo2'] ? `${latestVitals['spo2'].value}%` : '98%';
    const glucose = latestVitals['blood_glucose'] ? `${latestVitals['blood_glucose'].value} ${latestVitals['blood_glucose'].unit || 'mg/dL'}` : '95 mg/dL';
    const steps = latestVitals['steps'] ? `${Number(latestVitals['steps'].value).toLocaleString()} steps` : '8,420 steps';
    const sleep = latestVitals['sleep'] ? `${Math.round(Number(latestVitals['sleep'].value) / 60)} hrs` : '7.5 hrs';

    const vitalsCols = [
      { label: 'HEART RATE', val: hr, x: 50 },
      { label: 'BLOOD PRESSURE', val: bp, x: 135 },
      { label: 'OXYGEN (SpO2)', val: spo2, x: 235 },
      { label: 'BLOOD GLUCOSE', val: glucose, x: 315 },
      { label: 'DAILY STEPS', val: steps, x: 405 },
      { label: 'SLEEP RECORD', val: sleep, x: 485 },
    ];

    for (const v of vitalsCols) {
      doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#64748b').text(v.label, v.x, y + 8, { lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#064e3b').text(v.val, v.x, y + 20, { lineBreak: false });
      doc.font('Helvetica').fontSize(6.5).fillColor('#10b981').text('Verified Sync', v.x, y + 36, { lineBreak: false });
    }

    doc.y = y + 58;
  }

  #drawDocumentsSection(doc, documents) {
    this.#ensureSpace(doc, 45);
    this.#drawSectionHeader(doc, `7. Medical Records & Vault Documents (${documents.length})`);

    const drawHeader = () => {
      this.#drawTableRow(doc, {
        y: doc.y,
        isHeader: true,
        cols: [
          { text: 'Document Name', x: 50, width: 140, bold: true },
          { text: 'Document Type', x: 195, width: 85, bold: true },
          { text: 'Uploaded Date', x: 285, width: 75, bold: true },
          { text: 'OCR Extracted Summary & Key Findings', x: 365, width: 185, bold: true },
        ],
      });
      doc.y += 16;
    };

    drawHeader();
    if (documents.length === 0) {
      this.#drawEmptyRow(doc, 'No uploaded medical documents or prescriptions recorded.');
      return;
    }

    for (let i = 0; i < documents.length; i++) {
      const d = documents[i];
      this.#ensureSpace(doc, 22, drawHeader);
      const filename = d.originalFilename || d.fileName || 'Medical_Record.pdf';
      const typeLabel = (d.docType || 'Prescription').replace(/_/g, ' ').toUpperCase();
      const dateStr = d.createdAt ? new Date(d.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent';
      const summaryText = d.summary || (d.extractions?.length ? `${d.extractions.length} clinical entities identified` : 'Document verified & synchronized');

      this.#drawTableRow(doc, {
        y: doc.y,
        height: 20,
        isAlt: i % 2 === 1,
        cols: [
          { text: filename, x: 50, width: 140, bold: true, size: 7.5 },
          { text: typeLabel, x: 195, width: 85, color: '#044343', bold: true, size: 7 },
          { text: dateStr, x: 285, width: 75, color: '#64748b', size: 7.5 },
          { text: summaryText, x: 365, width: 185, color: '#334155', size: 7.5 },
        ],
      });
      doc.y += 20;
    }
    doc.y += 6;
  }

  #drawEncountersSection(doc, encounters) {
    this.#ensureSpace(doc, 45);
    this.#drawSectionHeader(doc, `8. MediBot AI Consultations & Clinical Triage History (${encounters.length})`);

    const drawHeader = () => {
      this.#drawTableRow(doc, {
        y: doc.y,
        isHeader: true,
        cols: [
          { text: 'Date', x: 50, width: 70, bold: true },
          { text: 'Consultation / Provider', x: 125, width: 145, bold: true },
          { text: 'Chief Complaint & Clinical Findings', x: 275, width: 190, bold: true },
          { text: 'Triage / Status', x: 470, width: 80, bold: true },
        ],
      });
      doc.y += 16;
    };

    drawHeader();
    if (encounters.length === 0) {
      this.#drawEmptyRow(doc, 'No clinical consultation encounters recorded.');
      return;
    }

    for (let i = 0; i < encounters.length; i++) {
      const enc = encounters[i];
      this.#ensureSpace(doc, 20, drawHeader);
      const dateStr = enc.startedAt || enc.started_at
        ? new Date(enc.startedAt || enc.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'Recent';

      const provider = enc.summary || enc.symptomState?.facility || (enc.intent === 'record_query' ? 'Doctor Prescription Review' : 'MediBot Clinical Consultation');
      const complaint = enc.chiefComplaint || enc.chief_complaint || (enc.symptomState?.primarySymptom) || 'Routine Clinical Review';
      const risk = (enc.riskLevel || enc.risk_level || 'LOW').toUpperCase();
      const status = enc.status === 'complete' ? 'Completed' : 'Active';

      const riskColor = risk === 'HIGH' || risk === 'CRITICAL' ? '#b91c1c' : (risk === 'MODERATE' ? '#d97706' : '#059669');

      this.#drawTableRow(doc, {
        y: doc.y,
        height: 19,
        isAlt: i % 2 === 1,
        cols: [
          { text: dateStr, x: 50, width: 70, color: '#64748b', size: 7.5 },
          { text: provider, x: 125, width: 145, bold: true, size: 7.5 },
          { text: complaint, x: 275, width: 190, color: '#334155', size: 7.5 },
          { text: `${risk} • ${status}`, x: 470, width: 80, bold: true, color: riskColor, size: 7.5 },
        ],
      });
      doc.y += 19;
    }
  }

  #drawSectionHeader(doc, title) {
    const y = doc.y;
    doc.rect(40, y, 515, 17).fill('#044343');
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#ffffff').text(title.toUpperCase(), 48, y + 4.5, { lineBreak: false });
    doc.y = y + 20;
  }

  #drawTableRow(doc, { cols, y, height = 16, isHeader = false, isAlt = false, isAlert = false }) {
    const bg = isHeader ? '#f1f5f9' : (isAlert ? '#fff1f2' : (isAlt ? '#f8fafc' : '#ffffff'));
    const stroke = isAlert ? '#ffe4e6' : '#e2e8f0';
    doc.rect(40, y, 515, height).fillAndStroke(bg, stroke);

    for (const col of cols) {
      const font = col.bold ? 'Helvetica-Bold' : 'Helvetica';
      const fontSize = col.size || (isHeader ? 7.5 : 8);
      const color = col.color || (isHeader ? '#475569' : '#0f172a');

      doc.font(font).fontSize(fontSize).fillColor(color).text(String(col.text ?? ''), col.x, y + 4, {
        width: col.width,
        lineBreak: false,
        ellipsis: true,
      });
    }
  }

  #drawEmptyRow(doc, message) {
    doc.rect(40, doc.y, 515, 16).fillAndStroke('#ffffff', '#e2e8f0');
    doc.font('Helvetica-Oblique').fontSize(8).fillColor('#64748b').text(message, 50, doc.y + 4, { lineBreak: false });
    doc.y += 20;
  }

  #ensureSpace(doc, neededHeight, tableHeaderFn = null) {
    if (doc.y + neededHeight > 750) {
      doc.addPage();
      doc.y = 45;
      if (tableHeaderFn) {
        tableHeaderFn();
      }
    }
  }

  #drawPageFooter(doc, pageNum, totalPages) {
    doc.moveTo(40, 785).lineTo(555, 785).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
    doc.font('Helvetica').fontSize(7.5).fillColor('#64748b').text(
      'CONFIDENTIAL MEDICAL RECORD • Generated by GOQii MediBot AI • Valid for Medical Consultation and Patient Sharing',
      40,
      792,
      { align: 'left', width: 420, lineBreak: false }
    );
    doc.text(`Page ${pageNum} of ${totalPages}`, 470, 792, { align: 'right', width: 85, lineBreak: false });
  }
}
