export type BigIntLike = number | string | BigInt;
export type DataLike = Uint8Array | number[] | string;

export class Pubkey {
	static fromXY(x: BigIntLike, y: BigIntLike): Pubkey;
	static from(value: Uint8Array | string | {x: BigIntLike, y: BigIntLike}): Pubkey;
	constructor(v?: Uint8Array);
	set x(i: BigIntLike);
	set y(i: BigIntLike);
	get x(): Uint8Array;
	get y(): Uint8Array;
	toAddress(): string;
	toObject(): {x: Uint8Array, y: Uint8Array};
	toPhex(): string;
	toJSON(): {x: string, y: string};
}

export type GatewayFn = (hash: string, spec: ContentHashSpec, data: Uint8Array) => string;
export class ContentHashSpec {
	readonly codec: number;
	readonly name: string;
	readonly scheme?: string;
	gateway?: GatewayFn;
}
export const Onion: ContentHashSpec | {
	fromPubkey(pubkey: DataLike, version?: number): Uint8Array;
};
export const GenericURL: ContentHashSpec;
export const DataURL: ContentHashSpec;
export const IPFS: ContentHashSpec;
export const IPNS: ContentHashSpec;
export const Swarm: ContentHashSpec;
export const Arweave: ContentHashSpec;

export class ContentHash {
	static fromParts(codec: number | ContentHashSpec, data: DataLike): ContentHash;
	static fromOnion(hash: DataLike): ContentHash;
	static fromEntry(key: string, value: any): ContentHash;
	static fromBytes(raw: DataLike): ContentHash;
	static fromURL(url: String | URL): ContentHash;
	constructor(v: Uint8Array);
	readonly bytes: Uint8Array;
	get codec(): number;
	get spec(): ContentHashSpec;
	get data(): Uint8Array;
	toHash(): string;
	toObject(): object;
	toEntry(): [key: string, value: any];
	toURL(): string;
	toGatewayURL(): string;
	toPhex(): string;
	toJSON(): string;
}

export type CoinQuery = Coin | number | string | {name?: string, type?: number, chain?: number};

export class Coin {
	static fromType(type: number): Coin;
	static fromName(name: string): Coin;
	static fromChain(chain: number): Coin;
	static from(query: CoinQuery): Coin;
	readonly type: number;
	readonly name: string;
	get chain(): number | undefined;
	encode(s: string): Uint8Array;
	decode(v: Uint8Array): string;
}

export class Address {
	static from(query: CoinQuery, value: string): Address;
	static fromParts(type: number, raw: DataLike): Address;	
	readonly coin: Coin;
	readonly bytes: Uint8Array;
	get type(): number;
	get name(): string;
	get value(): string;
	toObject(): {type: number, name: string, value: string, bytes: Uint8Array};
	toPhex(): string;
	toJSON(): string;
}

export type RecordObject = {[key: string]: any};

export class Record extends Map {
	static from(json: RecordObject): Record;
	
	toObject(): RecordObject;
	toJSON(): RecordObject;
	toEntries(compact: boolean): [key: string, value: any][];

	put(key: string, value?: any): void;

	static readonly CONTENTHASH: string;
	static readonly PUBKEY: string;
	static readonly NAME: string;
}

export class Node extends Map {
	static root(name?: string): Node;
	constructor(label: string, parent?: Node);

	readonly label: string;
	readonly parent: Node;
	record?: Record;

	get name(): string;
	get depth(): number;
	get nodes(): number;

	find(name: string): Node | undefined;
	create(name: string): Node;
	child(label: string): Node;
	importJSON(any: any): void;

	scan(fn: (node: Node, level: number) => void, level?: number): void;
	collect<T>(fn: (node: Node, level: number) => T | undefined): T[];
	flat(): Node[];
	print(): void;
}
