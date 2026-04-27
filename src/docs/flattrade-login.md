# Login Flow

APIKey and APISecert is used to generate a access token (JKey) that will be used in all our APIs to perform trading.

The access token generation process starts with an Authentication process initiated from a a web browser. You need to authorize the program using your client ID (UCC), trading password and PAN/year of birth.

Whether your program runs on a GUI or a console, you always have to access the web browser to create an access token which then allows you to use the API.

The access token has a validity of 24 hours so you only have to generate access tokenonce during the day.
(Note: Access tokens are cleared between 5 to 6 AM in the morning. We recommend you regenerate your access token after 6 AM).

Once you generate your access token, you can store it and bypass authentication for subsequent connects.

## Text-based flowchart

```text
[Apps]
  -- Redirect (params: api_key) -->
[Flattrade Login]

[Flattrade Login]
  -- Redirect response (request_code) -->
[Apps]

[Apps]
  -- POST request (api_key + request_code + hash(api_secret)) -->
[PI Server Validate API]

[PI Server Validate API]
  -- Response (access_token) -->
[Apps]
```

## Token Generation Steps

| Step | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Open the authorization URL `https://auth.flattrade.in/?app_key=APIKEY` in a browser. Replace `APIKEY` with the API key allocated to you.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2    | Enter your Client ID (UCC), password, and PAN/DOB, then submit.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 3    | After successful authorization, the authentication portal redirects to your URL with `request_code`, for example: `https://yourRedirectURL.com/?request_code=requestCodeValue`.<br><br>Notes: Redirect URL is pre-registered against each API key. If PROD and TESTING use different redirect URLs, each environment should use a different registered API key. `request_code` is a one-time code valid for only a few minutes and should be exchanged immediately.                                                                                                                                                          |
| 4    | Send a POST request to `https://authapi.flattrade.in/trade/apitoken` to validate `request_code` and get the token.<br><br>Request body example: `{"api_key":"xcvvwegfhgh4454646","request_code":"xxdfddfdfdsfdsf84okkdlfelfdfdfd345fsf","api_secret":"sdfdsfsdfdsfXXXXXXX"}`<br><br>Notes: (1) Refer to the security key handling document for detailed guidance. (2) Token is returned only if the request comes from the registered private static IP for the API key. `api_key` is the public API key. `request_code` is one-time and short-lived. `api_secret` should be `SHA-256(api_key + request_code + api_secret)`. |
| 5    | On success, the response includes values that can be used with the appropriate endpoints:<br><br>`{"token":"dsfdsf84okkdlfelfdfdfd3454545454ssdfsf","client":"CCODE123","status":"Ok","emsg":""}`                                                                                                                                                                                                                                                                                                                                                                                                                            |
