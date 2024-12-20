import { DEFAULT_COLLECTION } from "@llamaindex/core/global";
import { fs, path } from "@llamaindex/env";
import { exists } from "../FileSystem.js";
import { BaseKVStore, type StoredValue } from "./types.js";

export type DataType = Record<string, Record<string, StoredValue>>;

export class SimpleKVStore extends BaseKVStore {
  private persistPath: string | undefined;

  constructor(private data: DataType = {}) {
    super();
  }

  async put(
    key: string,
    val: StoredValue,
    collection: string = DEFAULT_COLLECTION,
  ): Promise<void> {
    if (!(collection in this.data)) {
      this.data[collection] = {};
    }
    this.data[collection]![key] = structuredClone(val); // Creating a shallow copy of the object

    if (this.persistPath) {
      await this.persist(this.persistPath);
    }
  }

  async get(
    key: string,
    collection: string = DEFAULT_COLLECTION,
  ): Promise<StoredValue> {
    const collectionData = this.data[collection];
    if (collectionData == null) {
      return null;
    }
    if (!(key in collectionData)) {
      return null;
    }
    return structuredClone(collectionData[key]) as StoredValue; // Creating a shallow copy of the object
  }

  async getAll(collection: string = DEFAULT_COLLECTION) {
    // fixme: null value here
    return structuredClone(this.data[collection])!; // Creating a shallow copy of the object
  }

  async delete(
    key: string,
    collection: string = DEFAULT_COLLECTION,
  ): Promise<boolean> {
    if (key in this.data[collection]!) {
      delete this.data[collection]![key];
      if (this.persistPath) {
        await this.persist(this.persistPath);
      }
      return true;
    }
    return false;
  }

  async persist(persistPath: string): Promise<void> {
    // TODO: decide on a way to polyfill path
    const dirPath = path.dirname(persistPath);
    if (!(await exists(dirPath))) {
      await fs.mkdir(dirPath);
    }
    await fs.writeFile(persistPath, JSON.stringify(this.data));
  }

  static async fromPersistPath(persistPath: string): Promise<SimpleKVStore> {
    const dirPath = path.dirname(persistPath);
    if (!(await exists(dirPath))) {
      await fs.mkdir(dirPath);
    }

    let data: DataType = {};
    try {
      const fileData = await fs.readFile(persistPath);
      data = JSON.parse(fileData.toString());
    } catch (e) {
      console.error(
        `No valid data found at path: ${persistPath} starting new store.`,
      );
    }

    const store = new SimpleKVStore(data);
    store.persistPath = persistPath;
    return store;
  }

  toDict(): DataType {
    return this.data;
  }

  static fromDict(saveDict: DataType): SimpleKVStore {
    return new SimpleKVStore(saveDict);
  }
}
