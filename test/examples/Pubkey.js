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
dump(Pubkey.fromXY(3n, 4n));
dump(Pubkey.from({x: 1, y: 2}));
dump(Pubkey.from({x: new Uint8Array(32), y: 2}));

let a = new Pubkey();
a.x = 1337;
console.log(a.toPhex());