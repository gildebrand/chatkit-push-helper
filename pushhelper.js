import Rx from 'rxjs/Rx';

const storage = require('node-persist');

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

        if (unreadMessagesCount === 1) {
            title = rooms[0].name;
            text = rooms[0].messages[0].text;
        } else {
            text = "You have " + unreadMessagesCount + " new messages";
        }

        rooms.forEach((room) => {
            storage.setItemSync(user.id + ':' + room.id, room.messages[0].id);
        });

        return {
            title: title,
            message: text,
            userId: user.id
        }
    }

    sendPushToUsers(users) {
        return Rx.Observable.combineLatest(
            ...users.map(user => this.notifyUserAboutMessages(user))
        );
    }

    notifyUserAboutMessages(user) {
        storage.initSync();

        let notifications = this.getNotificationFromUserObject(user);

        console.log(notifications);

        return Rx.Observable.fromPromise(new Promise((resolve, reject) => {
            setTimeout(resolve, 1000);
        }));
    }

    getLastPushedMessage(userId, roomId) {
        return storage.getItemSync(userId + ':' + roomId) || 0;
    }
}