import * as coda from "@codahq/packs-sdk";

export const ProjectSchema = coda.makeObjectSchema({
    name: 'Project',
    displayProperty: 'name',
    idProperty: 'id',
    properties: {
        id: { type: coda.ValueType.String },
        name: { type: coda.ValueType.String },
        description: { type: coda.ValueType.String },
        created: { type: coda.ValueType.Number, codaType: coda.ValueHintType.Date, },
    }
});

export const DatasetSchema = coda.makeObjectSchema({
    name: 'Dataset',
    displayProperty: 'name',
    idProperty: 'id',
    properties: {
        id: { type: coda.ValueType.String },
        project_id: { type: coda.ValueType.String },
        project_name: { type: coda.ValueType.String },
        name: { type: coda.ValueType.String },
        description: { type: coda.ValueType.String },
        created: { type: coda.ValueType.Number, codaType: coda.ValueHintType.Date, },
    }
});