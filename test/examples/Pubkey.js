import {Pubkey} from '../../src/index.js';

function dump(x) {
	console.log(x);
	console.log({
		toObject: x.toObject(),
		toJSON: x.toJSON(),
	});
}

dump(new Pubkey());
dump(Pubkey.fromXY(1, 2));
dump(Pubkey.fromXY(3n, '0x4'));
dump(Pubkey.from({x: 1, y: 2}));
dump(Pubkey.from({x: new Uint8Array(32), y: new Array(32).fill(0)}));

let a = new Pubkey();
a.x = '01234';
a.x = Array(32).fill(0);
a.x = new Uint8Array(32);
a.x = 0x1337;
a.y = 69420n;
dump(a);
