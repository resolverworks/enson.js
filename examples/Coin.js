import {Coin} from '../src/Coin.js';

console.log(Coin.from('eth'));
console.log(Coin.from(60));
console.log(Coin.from({name: 'eth'}));
console.log(Coin.from({type: 60}));
console.log(Coin.from({chain: 1}));

let $eth = Coin.from(60);

let address = '0x51050ec063d393217B436747617aD1C2285Aeeee';
console.log($eth.decode(address));
console.log($eth.decode(address.toLowerCase()));
console.log($eth.decode(address.toUpperCase()));

console.log(Coin.from('btc'));
console.log(Coin.from(0));
