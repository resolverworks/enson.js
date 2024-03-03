import {Node} from '../src/Node.js';

let root = Node.root();

let a = root.create('a.b.c.d');
console.log(a.name);
a.importJSON({
	name: 'nice chonk',
	$eth: '0x51050ec063d393217B436747617aD1C2285Aeeee'
});

root.print();

console.log([...root.nodes()].map(x => x.name));
console.log([...root.records()]);
