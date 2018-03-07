import Chatkit from 'pusher-chatkit-server';
import Rx from 'rxjs/Rx';
import {ChatkitHelper} from "./chatkithelper";
import {PushHelper} from "./pushhelper";

const config = require('./config.json');

const ckInst = new Chatkit({
    instanceLocator: config.chatkit.instanceLocator,
    key: config.chatkit.key,
});

const pushHelper = new PushHelper();
const ckHelper = new ChatkitHelper(ckInst, pushHelper);

Rx.Observable.merge(
    Rx.Observable.interval(config.pollingInterval * 1000),
    Rx.Observable.of(null)
).do(() => console.log('Launching new job'))
    .do(() => console.time('timer'))
    .flatMap(() => ckHelper.getUsers())
    .flatMap(users => ckHelper.populateUsersWithRoomsAndMessages(users, config.messagesToLoad))
    .flatMap(users => ckHelper.populateUsersWithCursors(users))
    .map(users => ckHelper.filterUsersRoomsAndMessages(users))
    .do(users => console.log('Should send push messages to ' + users.length + ' users'))
    .filter(users => {
        if (users.length === 0){
            console.timeEnd('timer');
        }

        return users.length > 0
    })
    .flatMap(users => pushHelper.sendPushToUsers(users))
    .do(() => console.log('Completed sending push messages'))
    .do(() => console.timeEnd('timer'))
    .subscribe();