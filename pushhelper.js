import Rx from 'rxjs/Rx';

const storage = require('node-persist');
const config = require('./config.json');
const request = require('request');

export class PushHelper {
    constructor() {
        storage.initSync();
    }

    getNotificationFromUserObject(user) {
        const rooms = user.rooms.map(room => {
            room.messages
                .filter(message => message.id > this.getLastPushedMessage(user.id, room.id))
                .map(() => room);

            return room;
        });

        const unreadMessagesCount = rooms.reduce((unreadMessagesCarry, room) => {
            return unreadMessagesCarry + room.messages.length;
        }, 0);

        let text = null;
        let title = null;
        let roomIds = rooms.map(room => room.id);

        if (unreadMessagesCount === 1) {
            title = 'New message';
            text = rooms[0].name + ': ' + rooms[0].messages[0].text;
        } else if (rooms.length === 1) {
            title = 'Unread messages';
            text = rooms[0].name + ': ' + "You have " + unreadMessagesCount + " unread messages";
        } else {
            title = 'Unread messages';
            text = "You have " + unreadMessagesCount + " unread messages";
        }

        rooms.forEach((room) => {
            storage.setItemSync(user.id + ':' + room.id, room.messages[0].id);
        });

        text = text.replace(/[\s|\n|\r]{1,}/g, " ");

        return {
            title: title,
            message: text,
            user_id: parseInt(user.id, 10),
            rooms: roomIds
        }
    }

    sendPushToUsers(users) {
        storage.initSync();

        let notifications = users.map(user => this.getNotificationFromUserObject(user));

        notifications.forEach(notification => console.log(notification));

        return this.getAccessToken()
            .flatMap(token => Rx.Observable.fromPromise(new Promise((resolve, reject) => {
                request(config.push.endpoint, {
                    json: true,
                    strictSSL: config.push.strictSSL,
                    body: {
                        notifications: notifications
                    },
                    headers: {
                        'Authorization': 'Bearer ' + token.accessToken
                    },
                    method: 'POST'
                }, function (error, response, body) {
                    if (!error && response.statusCode === 200) {
                        resolve();
                    } else {
                        reject([response, body]);
                    }
                })
            })));
    }

    /**
     * @returns {Observable<Token>}
     */
    getAccessToken() {
        if (this.token) {
            // If the access token expires within five seconds, we want to refresh it
            const futureDate = (Date.now() + 5000);

            if (this.token.expiresAt < futureDate) {
                console.log("access token expired, refresh it");
                return this.refreshToken(this.token);
            } else {
                console.log("already have a valid access token, using it");
                return Rx.Observable.of(this.token);
            }
        } else {
            console.log("issuing a new access token");

            return this.issueNewToken();
        }
    }

    /**
     * @param {Token} token
     * @returns {Observable<Token>}
     */
    refreshToken(token) {
        return Rx.Observable.fromPromise(new Promise((resolve, reject) => {
            request(config.push.auth.endpoint, {
                json: true,
                strictSSL: config.push.strictSSL,
                body: {
                    client_id: config.push.auth.clientId,
                    client_secret: config.push.auth.clientSecret,
                    grant_type: config.push.auth.refreshGrantType,
                    refresh_token: token.refreshToken
                },
                method: 'POST'
            }, function (error, response, body) {
                if (!error && response.statusCode === 200) {
                    resolve(new Token(body))
                } else {
                    console.log(error, response, body);
                    reject(error);
                }
            })
        })).catch(() => {
            console.log("refresh token failed!");
            return this.issueNewToken();
        }).do(token => this.token = token);
    }

    /**
     * @returns {Observable<Token>}
     */
    issueNewToken() {
        console.log("issueNewToken called");
        return Rx.Observable.fromPromise(new Promise((resolve, reject) => {
            request(config.push.auth.endpoint, {
                json: true,
                strictSSL: config.push.strictSSL,
                body: {
                    client_id: config.push.auth.clientId,
                    client_secret: config.push.auth.clientSecret,
                    grant_type: config.push.auth.grantType
                },
                method: 'POST'
            }, function (error, response, body) {
                if (!error && response.statusCode === 200) {
                    resolve(new Token(body))
                } else {
                    reject(error);
                }
            })
        })).do(token => this.token = token);
    }

    getLastPushedMessage(userId, roomId) {
        return storage.getItemSync(userId + ':' + roomId) || 0;
    }
}

class Token {
    /**
     * @param data
     */
    constructor(data) {
        /**
         * @type {Date}
         */
        this.expiresAt = new Date(Date.now() + data.expires_in * 1000);

        /**
         * @type {string}
         */
        this.accessToken = data.access_token;

        /**
         * @type {string}
         */
        this.refreshToken = data.refresh_token;
    }
}