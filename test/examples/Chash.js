import {Chash} from '../../src/index.js';

function dump(x) {
	console.log();
	console.log(x, x.spec);
	console.log({		
		toHash: x.toHash(),
		toEntry: x.toEntry(),
		toURL: x.toURL(),
		toGatewayURL: x.toGatewayURL(),
		toPhex: x.toPhex(),
	});
	console.log(x.toObject());
}

dump(Chash.from('0xe5010172002408011220c8a700c79100ff6d34c1be3d75729da863dbd4a86ec54b5347aaf9b88c4d137d'));
dump(Chash.from('k51qzi5uqu5dl6mkhgsua6663hpyb7zs8qjh5blic33j5393iie8abot6jydfh', 'ipns'));
dump(Chash.from('nice chonk', 'text'));
dump(Chash.from({nice: 'chonk'}, 'json'));
dump(Chash.from('http://expyuzz4wqqyqhjn.onion'));
dump(Chash.fromOnion('2gzyxa5ihm7nsggfxnu52rck2vv4rvmdlkiu3zzui5du4xyclen53wid'));
dump(Chash.from('http://2gzyxa5ihm7nsggfxnu52rck2vv4rvmdlkiu3zzui5du4xyclen53wid.onion'));
dump(Chash.from('ar://yBYkngZXGCQgYU-nUCwo5vns2ALUU0LXXZrCUlUUWkk'));
dump(Chash.from('yBYkngZXGCQgYU-nUCwo5vns2ALUU0LXXZrCUlUUWkk', 'ar'));
dump(Chash.from('<b>yo</b>', 'text/html'));
dump(Chash.from('QmZcH4YvBVVRJtdn4RdbaqgspFU8gH6P9vomDpBVpAL3u4', 'ipfs'));
dump(Chash.from('ipfs://QmZcH4YvBVVRJtdn4RdbaqgspFU8gH6P9vomDpBVpAL3u4'));
dump(Chash.from('0xe301017012201687de19f1516b9e560ab8655faa678e3a023ebff43494ac06a36581aafc957e'));
