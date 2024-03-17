import {Profile, Record, Coin, Address, Pubkey} from '../src/index.js';

let p = new Profile();
p.setText('name');
p.setText(['a', 'b']);
p.chash = true;

console.log(p.makeCalls().map(x => Buffer.from(x).toString('hex')));

for (let v of Record.from({a: '1', '$eth': '0x51050ec063d393217B436747617aD1C2285Aeeee'.toLowerCase()})) {
	console.log(v);

}



// console.log([...Coin]);
// console.log(Coin.count);


console.log(Address.from('0x51050ec063d393217B436747617aD1C2285Aeeee').toObject());

console.log(Coin.from('eth'));
console.log(Coin.fromChain(2));
console.log(Coin.from(99129));

console.log(Pubkey.from({x: 1, y: 2}).toJSON());