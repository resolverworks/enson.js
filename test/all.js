// import {readdirSync, lstatSync} from 'node:fs';

// for (let f of find_tests(new URL('.', import.meta.url))) {	
// 	await import(f);
// }

// function find_tests(dir, v = []) {
// 	for (let name of readdirSync(dir)) {
// 		let f = new URL(name, dir);
// 		if (lstatSync(f).isDirectory()) {
// 			find_tests(f, v);
// 		} else if (name.includes('.t.')) {
// 			v.push(f);
// 		}
// 	}
// 	return v;
// }

import './Address.t.js';
