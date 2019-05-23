# chatkit-push-helper
Since Pusher's Chatkit product doesn't support push notifications natively just yet, I built a NodeJS application that polls Chatkit for new messages and calls your own API to send the push notifications.

To get started, you first need to create your `config.json` file. Below is an example of what this file can look like: 

```
{
  "pollingInterval": 30,
  "messagesToLoad": 5,
  "chatkit": {
    "instanceLocator": "MY_INSTANCE_LOCATER_FROM_PUSHER_DASH",
    "key": "MY_VERY_SECRET_KEY_FROM_PUSHER_DASH",
    "apiVersion": "v2"
  },
  "push": {
    "endpoint": "https://api.myapplication.com/v1/chatkit/push",
    "strictSSL": true,
    "auth": {
      "endpoint": "https://api.myapplication.com/v1/oauth/token",
      "grantType": "client_grant",
      "refreshGrantType": "refresh_token",
      "clientId": 2,
      "clientSecret": "j1xr1ykCGGERx120dYyGLKasdfd93uhpwivdCH3QIRDO2"
    }
  }
}
```

The `pollingInterval` attribute is in seconds. I set it to thirty seconds in my application. The `messagesToLoad` attribute tells the script how many messages it should download per user and room. In my application it's not super important that the user get's notified about every single message, but more important that they get notified about new messages at all. That's why I decided to keep this attribute on the low side.

The `push` attribute holds information about the endpoint to send the push notifications, and how to authenticate with that endpoint. I've used a standard OAuth2.0 implementation where I've issued a client that has permissions to send push notifications only.

This is what the payload data sent from the script to the push endpoint looks like

```
{
   "notifications":[
      {
         "message":"You got 5 unread messages from Anton",
         "user_id":156,
         "rooms":[
            12345
         ]
      }
   ]
}
```

To get this helper application going you need to:
- Set up your `config.json` file
- Run `npm install`
- Run `npm start run`. This will build the code using Babel and run it.
