# Health and wearable connections

The app has two connection paths:

- **Apple Health / Health Connect:** the Expo native app requests only the health types the member selects. Expo reads those records and uploads them directly to the YourWellness backend/database with the phone platform as their source. This is a native on-device permission flow, not provider OAuth. Apple Watch data is available through Apple Health when the watch is paired there.
- **Fitbit, WHOOP, Oura, Garmin, and other cloud providers:** the backend creates an OpenWearables user and requests an authorization URL. The mobile app opens that URL in the system browser. OpenWearables returns to `goqiihealth://wearables/callback`; the app then asks the backend to check OpenWearables and only shows the provider as connected when that service confirms it.

## Required configuration

Set these in the backend environment, using the real URL and API key issued by the local/deployed OpenWearables service:

```dotenv
OPEN_WEARABLES_BASE_URL=http://localhost:8000
OPEN_WEARABLES_API_KEY=
OPEN_WEARABLES_REDIRECT_URL=goqiihealth://wearables/callback
REDIRECT_ALLOWLIST=goqiihealth://wearables/callback,https://your-mobile-web-origin.example
```

Enable each provider and configure its OAuth client credentials in OpenWearables itself. The app's provider list is populated from OpenWearables' enabled provider list; provider names in this repository are not evidence that provider credentials are configured. Each cloud provider also needs the OpenWearables server callback registered in that provider's developer console; use the callback URL shown by your OpenWearables deployment. Some providers reject localhost callbacks, in which case expose the OpenWearables API through a public HTTPS hostname for development.

Allow `goqiihealth://wearables/callback` as the app's post-authorization redirect in OpenWearables, and allow the web app origin for browser login. This mobile redirect is separate from each cloud provider's OAuth callback: Fitbit/WHOOP/etc. must register the OpenWearables server callback URL for that provider, not the app deep link. Mobile OAuth requires a new Expo native development/production build with the `goqiihealth` URL scheme; Expo Go and a web export cannot register this app link.

## Disconnect and data

Disconnect calls OpenWearables' connection delete endpoint first. Only after it succeeds, or OpenWearables reports that the connection is already absent, does the backend mark its local wearable link disconnected. A failed/unauthorized upstream call leaves the local state unchanged and returns an error. Previously imported health records are retained; disconnect stops future provider access/sync and does not erase historical records.

Apple Health and Health Connect permissions are revoked through the phone-health flow; they are not OpenWearables OAuth connections.
