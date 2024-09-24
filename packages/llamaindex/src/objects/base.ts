import type { BaseTool } from "@llamaindex/core/llms";
import {
  BaseObjectNodeMapping,
  ObjectRetriever,
} from "@llamaindex/core/objects";
import type { BaseNode, Metadata } from "@llamaindex/core/schema";
import { TextNode } from "@llamaindex/core/schema";
import type { VectorStoreIndex } from "../indices/vectorStore/index.js";

const convertToolToNode = (tool: BaseTool): TextNode => {
  const nodeText = `
    Tool name: ${tool.metadata.name}
    Tool description: ${tool.metadata.description}
  `;
  return new TextNode({
    text: nodeText,
    metadata: { name: tool.metadata.name },
    excludedEmbedMetadataKeys: ["name"],
    excludedLlmMetadataKeys: ["name"],
  });
};

export class SimpleToolNodeMapping extends BaseObjectNodeMapping {
  private _tools: Record<string, BaseTool>;

  private constructor(objs: BaseTool[] = []) {
    super();
    this._tools = {};
    for (const tool of objs) {
      this._tools[tool.metadata.name] = tool;
    }
  }

  objNodeMapping(): Record<any, any> {
    return this._tools;
  }

  toNode(tool: BaseTool): TextNode {
    return convertToolToNode(tool);
  }

  _addObj(tool: BaseTool): void {
    this._tools[tool.metadata.name] = tool;
  }

  _fromNode(node: BaseNode): BaseTool {
    if (!node.metadata) {
      throw new Error("Metadata must be set");
    }
    return this._tools[node.metadata.name]!;
  }

  persist(persistDir: string, objNodeMappingFilename: string): void {
    // Implement the persist method
  }

  toNodes(objs: BaseTool[]): TextNode<Metadata>[] {
    return objs.map((obj) => this.toNode(obj));
  }

  addObj(obj: BaseTool): void {
    this._addObj(obj);
  }

  fromNode(node: BaseNode): BaseTool {
    return this._fromNode(node);
  }

  static fromObjects(objs: any, ...args: any[]): BaseObjectNodeMapping {
    return new SimpleToolNodeMapping(objs);
  }

  fromObjects<OT>(objs: any, ...args: any[]): BaseObjectNodeMapping {
    return new SimpleToolNodeMapping(objs);
  }
}

export class ObjectIndex {
  private _index: VectorStoreIndex;
  private _objectNodeMapping: BaseObjectNodeMapping;

  private constructor(index: any, objectNodeMapping: BaseObjectNodeMapping) {
    this._index = index;
    this._objectNodeMapping = objectNodeMapping;
  }

  static async fromObjects(
    objects: any,
    objectMapping: BaseObjectNodeMapping,
    // TODO: fix any (bundling issue)
    indexCls: any,
    indexKwargs?: Record<string, any>,
  ): Promise<ObjectIndex> {
    if (objectMapping === null) {
      objectMapping = SimpleToolNodeMapping.fromObjects(objects, {});
    }

    const nodes = objectMapping.toNodes(objects);

    const index = await indexCls.init({ nodes, ...indexKwargs });

    return new ObjectIndex(index, objectMapping);
  }

  async insertObject(obj: any): Promise<void> {
    this._objectNodeMapping.addObj(obj);
    const node = this._objectNodeMapping.toNode(obj);
    await this._index.insertNodes([node]);
  }

  get tools(): Record<string, BaseTool> {
    return this._objectNodeMapping.objNodeMapping();
  }

  async asRetriever(kwargs: any): Promise<ObjectRetriever<any>> {
    return new ObjectRetriever(
      this._index.asRetriever(kwargs),
      this._objectNodeMapping,
    );
  }

  asNodeRetriever(kwargs: any): any {
    return this._index.asRetriever(kwargs);
  }
}
