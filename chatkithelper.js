import Rx from "rxjs/Rx";

const request = require('request');

export class ChatkitHelper {
    constructor(chatkitInstance, pushHelperInstance, apiVersion) {
        /**
         * @type Chatkit
         */
        this.chatkitInstance = chatkitInstance;

        /**
         * @type PushHelper
         */
        this.pushHelperInstance = pushHelperInstance;

        /**
         * API version (.e.g "v2")
         * @type String
         */
        this.apiVersion = apiVersion;
    }

    /**
     * @returns {Observable}
     */
    getUsers() {
        return Rx.Observable.fromPromise(this.chatkitInstance.getUsers());
    }

    /**
     *
     * @param {string} userId
     * @returns {Observable}
     */
    getUserRooms(userId) {
        return Rx.Observable.fromPromise(this.chatkitInstance.apiInstance.request({
            method: 'GET',
            path: "/users/" + userId + "/rooms",
            jwt: this.chatkitInstance.getServerToken(),
        }).then(function (res) {
            return JSON.parse(res.body);
        }).catch(err => console.log(err)));
    }

    /**
     * @param userId
     * @param roomId
     * @param limit
     * @returns {Observable}
     */
    getRoomMessages(userId, roomId, limit) {
        return Rx.Observable.fromPromise(this.chatkitInstance.getRoomMessages(userId, roomId, {
            limit: limit
        }));
    }

    /**
     * @param userId
     * @returns {Observable}
     */
    getUserCursors(userId) {
        return Rx.Observable.fromPromise(new Promise((resolve, reject) => {
            const [_, __, location, instanceId] = this.chatkitInstance.instanceLocator.match(/^(v\d*):([a-z0-9]*):([a-f0-9\-]*)$/);
            request('https://' + location + '.pusherplatform.io/services/chatkit_cursors/' + this.apiVersion + '/' + instanceId + '/cursors/0/users/' + userId, {
                headers: {
                    'Authorization': 'Bearer ' + this.chatkitInstance.getServerToken()
                }
            }, function (error, response, body) {
                if (!error && response.statusCode === 200) {
                    resolve(JSON.parse(body));
                } else {
                    reject(error);
                    console.error("ERROR", error);
                }
            });
        }));
    }

    populateUsersWithRoomsAndMessages(users, messagesLimit) {
        return Rx.Observable.combineLatest(
            ...users.map(user => this
                .getUserRooms(user.id)
                .do(rooms => user.rooms = rooms)
                .flatMap(rooms =>
                    rooms.length ? Rx.Observable.combineLatest(
                        ...rooms.map(room => this
                            .getRoomMessages(user.id, room.id, messagesLimit)
                            .do(messages => room.messages = messages)
                        )
                    ) : Rx.Observable.of([])
                )
                .map(() => user)
            )
        )
    }

    populateUsersWithCursors(users) {
        return Rx.Observable.combineLatest(
            ...users.map(user => this
                .getUserCursors(user.id)
                .do(cursors => {
                    user.cursors = {};

                    for (const x in cursors) {
                        if (cursors.hasOwnProperty(x)) {
                            user.cursors[cursors[x].room_id] = cursors[x].position;
                        }
                    }
                })
                .map(() => user)
            )
        )
    }

    /**
     * @param users
     */
    filterUsersRoomsAndMessages(users) {
        return users.map(user => {
            // Remove rooms that doesn't have any unread messages
            user.rooms = user.rooms.map(room => {
                room.messages = room.messages
                    .filter(message => message.id > (user.cursors[room.id] || 0)) // Filter out messages that's unread
                    .filter(message => message.id > this.pushHelperInstance.getLastPushedMessage(user.id, room.id));

                return room;
            }).filter(room => room.messages.length > 0);

            return user;
        }).filter(user => {
            return user.rooms.length > 0;
        });
    }
}