import {Node} from '../src/Node.js';
import {Record} from '../src/Record.js';

// TODO: fix me

let root = Node.root();

root.create('sub.raffy.eth').record = Record.from({
	name: 'Raffy',
	'$eth': '0x51050ec063d393217B436747617aD1C2285Aeeee',
	'#': 'https://raffy.eth'
});
let sub2 = root.create('sub2.raffy.eth');
console.log(sub2);

console.log(root.depth);

root.find('sub3.raffy.eth');

root.find('sub.raffy.eth').create('a.b.c');

root.print();

console.log(root.flat().map(x => x.name));

console.log(JSON.stringify(root.toJSON(), null, '  '));