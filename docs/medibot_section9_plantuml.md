# MediBot — Section 9: PlantUML Diagram Source Code
## Symptom Assessment & Adaptive Questioning

Paste each block into **[plantuml.com/plantuml](https://www.plantuml.com/plantuml/uml/)** or render locally with the PlantUML JAR.

---

## Diagram 1 — Overall System Architecture (Component Diagram)

> Shows all major MediBot components with the Safety Engine, Orchestrator, Medical LLM, Context Engine, and data stores. Highlights the Safety boundary.

```plantuml
@startuml MediBot_System_Architecture
skinparam componentStyle rectangle
skinparam backgroundColor #FAFAFA
skinparam component {
  BackgroundColor #D6EAF8
  BorderColor #2980B9
  FontColor #1A252F
}
skinparam database {
  BackgroundColor #D5F5E3
  BorderColor #1E8449
}
skinparam rectangle {
  BackgroundColor #FDEDEC
  BorderColor #C0392B
}
skinparam actor {
  BackgroundColor #F9E79F
  BorderColor #B7950B
}

title MediBot — System Architecture

actor User

rectangle "Client Apps\nMobile / Web" as Client
rectangle "API Gateway\nAuth + Consent + Rate Limiting" as API

component "MediBot Orchestrator\n(stateless)" as Orch

package "Safety Boundary" {
  component "Safety Engine\n(Deterministic)" as Safety
  component "Response Safety Validator" as Validator
}

component "Intent Classifier" as Intent
component "Symptom / Entity Extractor" as Extract

package "Context Engine" {
  component "Query-Scoped Retrieval" as Context
  database "Patient Record DB" as PatientDB
  database "Timeline / Encounter DB" as Timeline
  database "Document Store" as Docs
  database "Wearable Store" as Wear
  database "Conversation DB" as Conv
  component "Medical RAG" as RAG
}

package "Clinical Rules" {
  component "Clinical Rules Engine" as Rules
  component "Drug Knowledge Provider" as Drug
  component "Clinical Priority Table" as PriorityTable
}

package "Medical LLM Runtime" {
  component "Model Router" as Router
  component "Primary Medical LLM\n(Fine-tuned)" as LLM
  component "Optional Specialist LLM" as SpecLLM
}

component "Escalation / Human Review" as Esc
database "Audit Log" as Audit

User --> Client
Client --> API
API --> Orch

Orch --> Safety : 1. pre-check
Orch --> Intent : 2. classify intent
Orch --> Extract : 3. extract symptoms
Orch --> Context : 4. retrieve context

Context --> PatientDB
Context --> Timeline
Context --> Docs
Context --> Wear
Context --> Conv
Context --> RAG

Orch --> Rules : 5. clinical rules
Rules --> Drug
Rules --> PriorityTable

Orch --> Router : 6. LLM call
Router --> LLM
Router --> SpecLLM
LLM --> Orch : tool calls (controlled)

Orch --> Validator : 7. validate response
Validator --> Client : 8. response + sources
Validator --> Audit

Safety --> Esc : HIGH RISK
Validator --> Esc : escalate flag

@enduml
```

---

## Diagram 2 — Adaptive Symptom Questioning Activity Flow

> Shows the step-by-step activity flow from user symptom report to encounter persistence. Includes the mid-loop safety check and the termination condition.

```plantuml
@startuml MediBot_Symptom_Activity_Flow
skinparam backgroundColor #FAFAFA
skinparam activity {
  BackgroundColor #D6EAF8
  BorderColor #2980B9
  FontColor #1A252F
  DiamondBackgroundColor #F9E79F
  DiamondBorderColor #B7950B
}
skinparam ArrowColor #2C3E50

title MediBot — Section 9: Adaptive Symptom Questioning Flow

start

:User reports symptom;

:Safety Engine — pre-check\n(Deterministic keyword + rule match);

if (HIGH RISK signal detected?) then (yes)
  #FF6B6B:Emergency protocol;\n(pre-approved response, no LLM)
  :Tag encounter HIGH_RISK\nRoute to human review queue;
  stop
else (no)
endif

:Symptom / Entity Extractor\nPopulate structured symptom object\n{onset, severity, location, character,\nradiation, aggravating, relieving,\nassociated_symptoms, duration};

:Context Engine\nRetrieve query-scoped Patient 360\n(cardiac history, meds, allergies,\nwearable trends, prior encounters);

repeat
  :Clinical Priority Table\nDetermine highest-priority\nmissing field;

  :Medical LLM\nPhrase ONE approved question\nfor the missing field\n(no diagnosis, no multi-question);

  :Response Validator\nCheck: single field, no clinical conclusion,\nmatches approved template;

  :Display question to user;

  :User answers;

  :Symptom Extractor\nParse answer → update\nstructured symptom object;

  :Safety Engine — mid-loop check\n(new HIGH RISK signal?);

  if (NEW HIGH RISK detected?) then (yes)
    #FF6B6B:Emergency protocol;
    :Tag encounter HIGH_RISK;
    stop
  else (no)
  endif

repeat while (Enough clinical information collected?) is (no)
-> yes;

:Final Risk Assessment\n(Deterministic rules over completed\nsymptom object + Patient 360);

if (Risk Level?) then (HIGH)
  #FF6B6B:Escalate;\n(emergency services / urgent GP referral)
else (MEDIUM / LOW)
  :Medical LLM generates\ninformational guidance\nfrom rules result + sources;
  :Response Validator\nCheck grounding + sources present;
endif

:Persist Clinical Encounter\n(encounter_id, symptom_object,\nquestion_log, risk_assessment,\nsources, model_version);

:Update Medical Timeline\n(HealthEvent type: symptom);

stop

@enduml
```

---

## Diagram 3 — Full Adaptive Questioning Sequence Diagram

> Shows all 10 components interacting across the complete symptom loop. Includes the safety alt block, the adaptive loop, and encounter persistence.

```plantuml
@startuml MediBot_Adaptive_Symptom_Sequence
skinparam backgroundColor #FAFAFA
skinparam sequence {
  ActorBackgroundColor #F9E79F
  ActorBorderColor #B7950B
  ParticipantBackgroundColor #D6EAF8
  ParticipantBorderColor #2980B9
  LifeLineBorderColor #AEB6BF
  ArrowColor #2C3E50
  BoxBackgroundColor #EBF5FB
}

title MediBot — Section 9: Adaptive Symptom Questioning (Full Sequence)

actor User
participant "Client App" as Client
participant "API Gateway" as API
participant "Orchestrator" as Orch
participant "Safety Engine" as Safety
participant "Symptom\nExtractor" as Extract
participant "Context Engine" as Context
database "Patient 360" as P360
participant "Clinical\nPriority Rules" as Priority
participant "Medical LLM" as LLM
participant "Response\nValidator" as Validator
database "Encounter DB" as EncounterDB

User -> Client : Report symptom\n(e.g. "I have chest pain")
Client -> API : POST /chat/turn
API -> Orch : Authorized request

Orch -> Safety : pre-check(input)
Safety --> Orch : Safe / Risk status

alt HIGH RISK detected
  Orch --> Client : Pre-approved emergency response
  Orch -> EncounterDB : Persist encounter\n(status: HIGH_RISK, flagged: true)
  Client --> User : Emergency guidance + contacts
end

Orch -> Extract : extract_symptoms(input)
Extract --> Orch : structured symptom object\n{onset: null, severity: null,\nradiation: null, character: null, ...}

Orch -> Context : retrieve_patient_context(symptom_type)
Context -> P360 : Query scoped patient data\n(cardiac_history, medications,\nallergies, wearable_trends)
P360 --> Context : Ranked patient context
Context --> Orch : Patient 360 snapshot

loop Until required fields collected

  Orch -> Priority : get_next_question_field(\n  symptom_object, patient_context)
  Priority --> Orch : next_field = "radiation"\n(priority rank: 1)

  Orch -> LLM : phrase_question(\n  field="radiation",\n  patient_context,\n  constraint="one question only")
  LLM --> Orch : "Does the pain spread to\nyour left arm, shoulder, or jaw?"

  Orch -> Validator : validate_question(question, field)
  Validator --> Orch : PASS (single field, no diagnosis)

  Orch --> Client : Display question
  Client --> User : Show question

  User -> Client : Answer
  Client -> API : POST /chat/turn (answer)
  API -> Orch : Authorized answer

  Orch -> Safety : mid_loop_check(answer)
  Safety --> Orch : Safe

  Orch -> Extract : parse_answer(answer, field="radiation")
  Extract --> Orch : {radiation: "left_arm", confidence: 0.95}

  Orch -> Orch : Update symptom object\nEvaluate completeness gate

end

Orch -> Safety : final_risk_assessment(\n  symptom_object, patient_context)
Safety --> Orch : risk_level = MEDIUM\nrules_triggered = ["chest_pain_radiation_arm"]

alt Risk = HIGH
  Orch --> Client : Escalation response + emergency contacts
else Risk = MEDIUM or LOW
  Orch -> LLM : generate_guidance(\n  risk_result, sources, constraints)
  LLM --> Orch : Informational guidance draft
  Orch -> Validator : validate_guidance(\n  guidance, rules_result, sources)
  Validator --> Orch : PASS + sources verified
  Orch --> Client : Guidance + cited sources
  Client --> User : Final response
end

Orch -> EncounterDB : persist_encounter({\n  encounter_id, symptom_object,\n  question_log, risk_assessment,\n  model_version, sources,\n  status: COMPLETE})

@enduml
```

---

## Diagram 4 — Clinical Priority Rules State Machine

> Shows how the symptom object transitions through states as fields are filled, driven by the clinical priority table. Each state represents the "current highest-priority missing field".

```plantuml
@startuml MediBot_Clinical_Priority_StateMachine
skinparam backgroundColor #FAFAFA
skinparam state {
  BackgroundColor #D6EAF8
  BorderColor #2980B9
  ArrowColor #2C3E50
  FontColor #1A252F
  StartColor #2ECC71
  EndColor #E74C3C
}

title MediBot — Clinical Priority Rules: Symptom State Machine\n(Example: Chest Pain)

[*] --> AskRadiation : Symptom extracted\nradiation = null (Priority 1)

AskRadiation : Ask about radiation\n"Does pain spread to arm/jaw/back?"
AskRadiation --> AskAssociatedSymptoms : radiation filled\n→ next priority: associated_symptoms

AskRadiation --> EMERGENCY : radiation = arm/jaw + HIGH RISK pattern\n→ mid-loop escalation

AskAssociatedSymptoms : Ask about associated symptoms\n"Any breathlessness, sweating, or nausea?"
AskAssociatedSymptoms --> AskSeverity : associated_symptoms filled\n→ next priority: severity

AskAssociatedSymptoms --> EMERGENCY : breathlessness + chest pain\n→ mid-loop escalation

AskSeverity : Ask about severity\n"On a scale of 0-10, how severe is it?"
AskSeverity --> AskCharacter : severity filled\n→ next priority: character

AskCharacter : Ask about character\n"Is the pain sharp, dull, or like pressure?"
AskCharacter --> AskOnset : character filled\n→ next priority: onset

AskOnset : Ask about onset\n"Did the pain come on suddenly or gradually?"
AskOnset --> AskAggravating : onset filled\n→ next priority: aggravating factors

AskAggravating : Ask about aggravating factors\n"Does anything make the pain worse?"
AskAggravating --> CompletenessGate : aggravating filled\n→ evaluate completeness

CompletenessGate : Evaluate completeness gate\nAll high-priority fields collected?
CompletenessGate --> RiskAssessment : Completeness gate PASSED

RiskAssessment : Run deterministic risk assessment\nover completed symptom object + Patient 360
RiskAssessment --> [*] : Encounter persisted

EMERGENCY : Emergency protocol\n(pre-approved response)
EMERGENCY --> [*] : Encounter persisted\n(HIGH_RISK, flagged)

@enduml
```

---

## Diagram 5 — Encounter Persistence Entity-Relationship Diagram

> Shows the data model produced by every completed symptom session — the clinical encounter record and its related entities.

```plantuml
@startuml MediBot_Encounter_ER_Diagram
skinparam backgroundColor #FAFAFA
skinparam class {
  BackgroundColor #D6EAF8
  BorderColor #2980B9
  FontColor #1A252F
  ArrowColor #2C3E50
  HeaderBackgroundColor #2980B9
  HeaderFontColor #FFFFFF
}

title MediBot — Section 9: Clinical Encounter Data Model

entity "ClinicalEncounter" as Encounter {
  * encounter_id : UUID <<PK>>
  --
  * user_id : UUID <<FK>>
  * created_at : TIMESTAMP
  * updated_at : TIMESTAMP
  * status : ENUM(IN_PROGRESS, COMPLETE, HIGH_RISK)
  * risk_level : ENUM(LOW, MEDIUM, HIGH)
  * action_taken : ENUM(guidance, escalation, emergency)
  * model_version : STRING
  * flagged_for_review : BOOLEAN
  * session_turns : INTEGER
}

entity "SymptomObject" as Symptom {
  * symptom_id : UUID <<PK>>
  --
  * encounter_id : UUID <<FK>>
  * primary_symptom : STRING
  onset : STRING
  duration : STRING
  severity : INTEGER (0-10)
  character : STRING
  location : STRING
  radiation : STRING
  aggravating_factors : STRING
  relieving_factors : STRING
  associated_symptoms : JSON
  extraction_confidence : FLOAT
}

entity "QuestionLog" as QLog {
  * question_id : UUID <<PK>>
  --
  * encounter_id : UUID <<FK>>
  * turn_number : INTEGER
  * field_asked : STRING
  * priority_rank : INTEGER
  * question_text : TEXT
  * user_answer : TEXT
  answer_confidence : FLOAT
  validator_status : ENUM(PASS, REVISED, BLOCKED)
}

entity "RiskAssessment" as Risk {
  * assessment_id : UUID <<PK>>
  --
  * encounter_id : UUID <<FK>>
  * risk_level : ENUM(LOW, MEDIUM, HIGH)
  rules_triggered : JSON
  sources_cited : JSON
  guidance_text : TEXT
  assessed_at : TIMESTAMP
  is_final : BOOLEAN
}

entity "Patient360Snapshot" as Snapshot {
  * snapshot_id : UUID <<PK>>
  --
  * encounter_id : UUID <<FK>>
  * user_id : UUID <<FK>>
  snapshot_at : TIMESTAMP
  medications_snapshot : JSON
  allergies_snapshot : JSON
  relevant_diagnoses : JSON
  wearable_trends : JSON
  prior_similar_encounters : JSON
}

entity "HealthEvent" as Event {
  * event_id : UUID <<PK>>
  --
  * user_id : UUID <<FK>>
  * encounter_id : UUID <<FK>>
  * event_type : ENUM(symptom, ...)
  * event_date : TIMESTAMP
  * severity : STRING
  source : STRING
  structured_data : JSON
}

Encounter ||--|| Symptom : "captures"
Encounter ||--|{ QLog : "contains"
Encounter ||--|| Risk : "produces"
Encounter ||--|| Snapshot : "uses context from"
Encounter ||--|| Event : "persisted as HealthEvent\nin Medical Timeline"

@enduml
```

---

## Diagram 6 — Mid-Loop Safety Escalation Sequence

> Shows exactly what happens when a HIGH RISK signal is detected mid-conversation during the adaptive questioning loop.

```plantuml
@startuml MediBot_MidLoop_Escalation
skinparam backgroundColor #FAFAFA
skinparam sequence {
  ActorBackgroundColor #F9E79F
  ActorBorderColor #B7950B
  ParticipantBackgroundColor #D6EAF8
  ParticipantBorderColor #2980B9
  ArrowColor #2C3E50
  BoxBackgroundColor #FDEDEC
}

title MediBot — Mid-Loop Safety Escalation (Section 9)

actor User
participant "Orchestrator" as Orch
participant "Safety Engine" as Safety
participant "Medical LLM" as LLM
participant "Response Validator" as Validator
database "Encounter DB" as DB
participant "Human Review\nQueue" as HumanReview

note over Orch, LLM
  Loop is in progress — 2 questions already asked.
  Symptom: chest_pain | radiation: left_arm (just filled)
end note

Orch -> LLM : phrase_question(field="associated_symptoms")
LLM --> Orch : "Are you experiencing\nany breathlessness or sweating?"
Orch --> User : Display question

User -> Orch : "Yes, I can't breathe properly\nand I'm sweating a lot"

Orch -> Safety : mid_loop_check(answer)
note right of Safety
  Pattern match:
  chest_pain + radiation_arm + breathlessness + sweating
  → HIGH RISK (possible AMI)
end note

Safety --> Orch : HIGH RISK detected\nTrigger: possible_acute_MI

Orch -> Orch : ABORT normal loop immediately\nDo NOT invoke LLM for guidance

Orch -> DB : persist_encounter({\n  status: HIGH_RISK,\n  flagged_for_review: true,\n  symptom_object: {...},\n  question_log: [...],\n  risk_trigger: "possible_acute_MI",\n  turns_completed: 3\n})

Orch -> HumanReview : enqueue_for_review(encounter_id)

Orch --> User : [PRE-APPROVED EMERGENCY RESPONSE]\n"⚠️ Your symptoms may indicate a serious\nheart condition. Call emergency services\n(112 / 999 / 911) immediately.\nDo not drive yourself."

note over User
  The Medical LLM was NOT invoked
  after the HIGH RISK signal.
  Response is pre-approved, clinically
  reviewed text — not model-generated.
end note

@enduml
```

---

## Quick Render Guide

| Tool | How to Use |
|---|---|
| **Online (easiest)** | Go to [plantuml.com/plantuml/uml](https://www.plantuml.com/plantuml/uml/) → paste any block above |
| **VS Code** | Install *PlantUML* extension by jebbs → preview with `Alt+D` |
| **IntelliJ / PyCharm** | PlantUML Integration plugin → right-click `.puml` file → Preview |
| **Command line** | `java -jar plantuml.jar yourfile.puml` |
| **Export format** | Use `-tpng`, `-tsvg`, or `-tpdf` flag for the JAR |

> **Tip:** Save each `@startuml ... @enduml` block as a `.puml` file (e.g. `medibot_section9_flow.puml`) for version control.
