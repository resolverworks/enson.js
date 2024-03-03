import {Pubkey} from '../src/Pubkey.js';

function dump(x) {
	console.log(x);
	console.log({
		toObject: x.toObject(),
		toJSON: x.toJSON(),
	});
}

dump(new Pubkey());
dump(Pubkey.fromXY(1, 2));
dump(Pubkey.from({x: 1, y: 2}));
