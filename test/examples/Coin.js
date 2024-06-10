import {Coin} from '../../src/index.js';

console.log(Coin.from('eth'));
console.log(Coin.from(60));
console.log(Coin.from({name: 'eth'}));
console.log(Coin.from({type: 60}));
console.log(Coin.from({chain: 1}));

let $eth = Coin.from(60);

let address = '0x51050ec063d393217B436747617aD1C2285Aeeee';
console.log($eth.parse(address));
console.log($eth.parse('0x' + address.toLowerCase().slice(2)));
console.log($eth.parse('0x' + address.toUpperCase().slice(2)));

console.log(Coin.from('btc'));
console.log(Coin.from(0));

console.log(Coin.from('etclegacy'));
console.log(Coin.from('etcLegacy'));

console.log(Coin.from('eth').toString());
console.log(Coin.from('eth').toJSON());
console.log(Coin.from('eth').toJSON(true));

