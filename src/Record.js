import {Address} from './Address.js';
import {ContentHash} from './ContentHash.js';
import {Pubkey} from './Pubkey.js';
import {error_with} from './utils.js';

const PREFIX_COIN = '$';
const PREFIX_MAGIC = '#';

export class Record extends Map {
	static from(json) {
		let self = new this();
		for (let [k, v] of Object.entries(json)) {
			self.put(k, v);
		}
		return self;
	}
	put(key, value) {
		// json:                  | getter:       | storage:
		// {"name": "Raffy"}      | text(key)     | {key: string} 
		// {"$eth": "0x5105...}   | addr(type)    | {${coin.name}: Address}
		// {"#ipfs": "Qm..."}     | contenthash() | {Record.CONTENTHASH: Contenthash}
		// {"#pubkey": {x, y}}    | pubkey()      | {Record.PUBKEY: Pubkey}
		// {"#name": "raffy.eth"} | name()        | {Record.NAME: string}
		try {
			let k = key;
			let x = value;
			if (k.startsWith(PREFIX_COIN)) {
				if (x) x = Address.from(k.slice(PREFIX_COIN.length), x);
				k = x.type;
			} else if (k === Record.PUBKEY) {
				if (x) x = Pubkey.from(x);
			} else if (k === Record.NAME) {
				// unmodified
			} else if (k.startsWith(PREFIX_MAGIC)) {
				if (x) x = ContentHash.fromEntry(k.slice(PREFIX_MAGIC.length), x);
				k = Record.CONTENTHASH;
			}
			if (x) {
				this.set(k, x);
			} else {
				this.delete(k);
			}
		} catch (err) {
			throw error_with(`Storing "${key}": ${err.message}`, {key, value}, err);
		}
	}
	text(key) {
		return this.get(key);
	}
	addr(type) {
		return this.get(type)?.bytes;
	}
	contenthash() {
		return this.get(Record.CONTENTHASH)?.bytes;
	}
	pubkey() {
		return this.get(Record.PUBKEY)?.bytes;
	}
	name() {
		return this.get(Record.NAME);
	}
	toEntries() {
		return [...this].map(x => {
			let [k, v] = x;
			if (v instanceof Address) {
				return [PREFIX_COIN + v.coin.name, v.toObject()];
			}
			switch (k) {
				case Record.CONTENTHASH: {
					[k, v] = v.toEntry();
					return [PREFIX_MAGIC + k, v];
				}
				case Record.PUBKEY: return [k, v.toObject()];
			}
			return x;
		});
	}
	toObject() {
		return Object.fromEntries(this.toEntries());
	}
	toJSONEntries() {
		return [...this].map(x => {
			let [k, v] = x;
			if (v instanceof Address) {
				return [PREFIX_COIN + v.coin.name, v.toJSON()];
			}
			switch (k) {
				case Record.CONTENTHASH: return [k, v.toJSON()];
				case Record.PUBKEY: return [k, v.toJSON()];
			}
			return x;
		});
	}
	toJSON() {
		return Object.fromEntries(this.toJSONEntries());
	}
}
for (let x of ['CONTENTHASH', 'PUBKEY', 'NAME']) {
	Object.defineProperty(Record, x, {value: PREFIX_MAGIC + x.toLowerCase()});
}
