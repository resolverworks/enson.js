import {Coin} from '../src/Coin.js';

console.log([...Coin]);
console.log(Array.from(Coin, x => x.name));
console.log(Coin.count);
