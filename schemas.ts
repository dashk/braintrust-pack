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

export const ExperimentSchema = coda.makeObjectSchema({
    name: 'Experiment',
    displayProperty: 'name',
    idProperty: 'id',
    properties: {
        id: { type: coda.ValueType.String },
        project_id: { type: coda.ValueType.String },
        name: { type: coda.ValueType.String },
        description: { type: coda.ValueType.String },
        created: { type: coda.ValueType.String, codaType: coda.ValueHintType.DateTime },
        repo_info: {
            type: coda.ValueType.Object,
            properties: {
                commit: { type: coda.ValueType.String },
                branch: { type: coda.ValueType.String },
                tag: { type: coda.ValueType.String },
                dirty: { type: coda.ValueType.Boolean },
                author_name: { type: coda.ValueType.String },
                author_email: { type: coda.ValueType.String },
                commit_message: { type: coda.ValueType.String },
                commit_time: { type: coda.ValueType.String, codaType: coda.ValueHintType.DateTime },
                git_diff: { type: coda.ValueType.String },
            }
        },
        commit: { type: coda.ValueType.String },
        base_exp_id: { type: coda.ValueType.String },
        deleted_at: { type: coda.ValueType.String, codaType: coda.ValueHintType.DateTime },
        dataset_id: { type: coda.ValueType.String },
        dataset_version: { type: coda.ValueType.String },
        public: { type: coda.ValueType.Boolean },
        user_id: { type: coda.ValueType.String },
    }
});

export const ScoreSchema = coda.makeObjectSchema({
    name: 'Score',
    displayProperty: 'name',
    properties: {
        name: { type: coda.ValueType.String },
        score: { type: coda.ValueType.Number },
        diff: { type: coda.ValueType.Number },
        improvements: { type: coda.ValueType.Number },
        regressions: { type: coda.ValueType.Number },
    }
});

export const MetricSchema = coda.makeObjectSchema({
    name: 'Metric',
    displayProperty: 'name',
    properties: {
        name: { type: coda.ValueType.String },
        metric: { type: coda.ValueType.Number },
        unit: { type: coda.ValueType.String },
        diff: { type: coda.ValueType.Number },
        improvements: { type: coda.ValueType.Number },
        regressions: { type: coda.ValueType.Number },
    }
});

export const ExperimentSummarySchema = coda.makeObjectSchema({
    name: 'ExperimentSummary',
    displayProperty: 'experiment_name',
    properties: {
        project_name: { type: coda.ValueType.String },
        experiment_name: { type: coda.ValueType.String },
        project_url: { type: coda.ValueType.String, codaType: coda.ValueHintType.Url },
        experiment_url: { type: coda.ValueType.String, codaType: coda.ValueHintType.Url },
        comparison_experiment_name: { type: coda.ValueType.String },
        scores: { type: coda.ValueType.Array, items: ScoreSchema },
        metrics: { type: coda.ValueType.Array, items: MetricSchema },
    }
});

export const ProjectScoreSchema = coda.makeObjectSchema({
    name: 'ProjectScore',
    idProperty: 'project_score_id',
    displayProperty: 'score_name',
    properties: {
        project_score_id: { type: coda.ValueType.String },
        project_name: { type: coda.ValueType.String },
        experiment_name: { type: coda.ValueType.String },
        created: { type: coda.ValueType.String, codaType: coda.ValueHintType.DateTime },
        score_name: { type: coda.ValueType.String },
        score_value: { type: coda.ValueType.Number },
    }
});

export const ExperimentLogSchema = coda.makeObjectSchema({
    name: 'ExperimentLog',
    displayProperty: 'experiment_log_id',
    idProperty: 'experiment_log_id',
    properties: {
        experiment_log_id: { type: coda.ValueType.String },
        created: { type: coda.ValueType.String, codaType: coda.ValueHintType.DateTime },
        project_id: { type: coda.ValueType.String },
        experiment_id: { type: coda.ValueType.String },
        // Need Dynamic schema
        inputStr: { type: coda.ValueType.String, description: 'Input as a JSON string' },
        outputStr: { type: coda.ValueType.String, description: 'Output as a JSON string'},
        expectedStr: { type: coda.ValueType.String, description: 'Expected as a JSON string'},
        scoresStr: { type: coda.ValueType.String, description: 'Scores as a JSON string'},
        metadataStr: { type: coda.ValueType.String, description: 'Metadata as a JSON string'},
    },
});