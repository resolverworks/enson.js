import {ContentHash} from '../src/ContentHash.js';

function dump(x) {
	console.log();
	console.log(x);
	console.log({
		toHash: x.toHash(),
		toEntry: x.toEntry(),
		toURL: x.toURL(),
		toObject: x.toObject(),
		toGatewayURL: x.toGatewayURL(),
		toPhex: x.toPhex(),
	});
}

dump(ContentHash.fromBytes('0xe5010172002408011220c8a700c79100ff6d34c1be3d75729da863dbd4a86ec54b5347aaf9b88c4d137d'));
dump(ContentHash.fromEntry('ipns', 'k51qzi5uqu5dl6mkhgsua6663hpyb7zs8qjh5blic33j5393iie8abot6jydfh'));
dump(ContentHash.fromEntry('text', 'nice chonk'));
dump(ContentHash.fromEntry('json', {nice: 'chonk'}));
dump(ContentHash.fromOnion('expyuzz4wqqyqhjn'));
dump(ContentHash.fromOnion('2gzyxa5ihm7nsggfxnu52rck2vv4rvmdlkiu3zzui5du4xyclen53wid'));
dump(ContentHash.fromURL('http://2gzyxa5ihm7nsggfxnu52rck2vv4rvmdlkiu3zzui5du4xyclen53wid.onion'));
dump(ContentHash.fromURL('ar://yBYkngZXGCQgYU-nUCwo5vns2ALUU0LXXZrCUlUUWkk'));
dump(ContentHash.fromEntry('ar', 'yBYkngZXGCQgYU-nUCwo5vns2ALUU0LXXZrCUlUUWkk'));
dump(ContentHash.fromEntry('contenthash', 'ar://yBYkngZXGCQgYU-nUCwo5vns2ALUU0LXXZrCUlUUWkk'));
dump(ContentHash.fromEntry('text/html', '<b>yo</b>'));
dump(ContentHash.fromEntry('ipfs', 'QmZcH4YvBVVRJtdn4RdbaqgspFU8gH6P9vomDpBVpAL3u4'));
dump(ContentHash.fromURL('ipfs://QmZcH4YvBVVRJtdn4RdbaqgspFU8gH6P9vomDpBVpAL3u4'));
dump(ContentHash.fromBytes('0xe301017012201687de19f1516b9e560ab8655faa678e3a023ebff43494ac06a36581aafc957e'));