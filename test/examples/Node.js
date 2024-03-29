import {Node, Record} from '../../src/index.js';

let root = Node.root();

let raffy = root.create('raffy.a.b.c.eth');
raffy.import({
	name: 'nice chonk',
	$eth: '0x51050ec063d393217B436747617aD1C2285Aeeee',
	'#json': [1, {x: 2}],
	[Record.PUBKEY]: {x: 1, y: 2},
});

root.find('eth').import({
	'.':    { name: 'Ether',  $eth: '0x0000000000000000000000000000000000000000' }, // eth
	slobo:  { name: 'Alex',   $eth: '0x0000000000000000000000000000000000000001' }, // slobo.eth
	darian: { name: 'Darian', $eth: '0x0000000000000000000000000000000000000002' }  // darian.eth
});

console.log(root.nodeCount, root.flat().length);
console.log(root.collect(x => x.name));

// create reverse nodes
let rev = root.create('addr.reverse');
root.scan(node => {
	let eth = node.record?.getAddress(60);
	if (eth) {
		rev.create(eth.toPhex().slice(2)).record = Record.from({
			[Record.NAME]: node.name
		});	
	}
});

// try a reverse
let slobo = root.find('0000000000000000000000000000000000000001.addr.reverse');
console.log(slobo.record.name());
// slobo.eth
console.log(slobo.depth);
// 2

console.log(JSON.stringify(root.toJSON(), null, '  '));
/*
{
  "eth": {
    ".": {
      "name": "Ether",
      "$eth": "0x0000000000000000000000000000000000000000"
    },
    "c": {
      "b": {
        "a": {
          "raffy": {
            "name": "nice chonk",
            "$eth": "0x51050ec063d393217B436747617aD1C2285Aeeee",
            "#pubkey": {
              "x": "0x1",
              "y": "0x2"
            }
          }
        }
      }
    },
    "slobo": {
      "name": "Alex",
      "$eth": "0x0000000000000000000000000000000000000001"
    },
    "darian": {
      "name": "Darian",
      "$eth": "0x0000000000000000000000000000000000000002"
    }
  },
  "reverse": {
    "addr": {
      "0000000000000000000000000000000000000000": {
        "#name": "eth"
      },
      "51050ec063d393217B436747617aD1C2285Aeeee": {
        "#name": "raffy.a.b.c.eth"
      },
      "0000000000000000000000000000000000000001": {
        "#name": "slobo.eth"
      },
      "0000000000000000000000000000000000000002": {
        "#name": "darian.eth"
      }
    }
  }
}
*/

root.print();
/*
[root] (2)
  eth* (3)
    c (1)
      b (1)
        a (1)
          raffy*
    slobo*
    darian*
  reverse (1)
    addr (4)
      0000000000000000000000000000000000000000*
      51050ec063d393217B436747617aD1C2285Aeeee*
      0000000000000000000000000000000000000001*
      0000000000000000000000000000000000000002*
*/
