import * as coda from "@codahq/packs-sdk";
import * as schemas from "./schemas";
import * as crypto from 'crypto';

// This line creates your new Pack.
export const pack = coda.newPack();

pack.addNetworkDomain("braintrustdata.com");

pack.setUserAuthentication({
  type: coda.AuthenticationType.HeaderBearerToken,
});

const getProject = async (id: string, context: coda.ExecutionContext) => {
  const response = await context.fetcher.fetch({
    method: "GET",
    url: `https://api.braintrustdata.com/v1/project/${id}`,
  });

  return response.body;
};

pack.addFormula({
  name: "GetProject",
  description: "Get a project object by its id",

  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "id",
      description: "The ID you would like to get project object to.",
      optional: false,
    }),
  ],

  resultType: coda.ValueType.String,

  execute: async function ([id], context) {
    return getProject(id, context);
  },
});

const getExperimentSummary = async (experimentId: string, context: coda.ExecutionContext) => {
  const response = await context.fetcher.fetch({
    method: "GET",
    url: `https://api.braintrustdata.com/v1/experiment/${experimentId}/summarize?summarize_scores=true`,
  });

  return response.body;
};

const getExperiments = async (context: coda.ExecutionContext, projectName?: string, limit?: number) => {
  const queryStrings = [];

  if (projectName) {
    queryStrings.push(`project_name=${projectName}`);
  }

  if (limit) {
    queryStrings.push(`limit=${limit}`)
  }

  const url = `https://api.braintrustdata.com/v1/experiment${queryStrings.length > 0 ? '?' + queryStrings.join('&') : ''}`;
  const response = await context.fetcher.fetch({
    method: "GET",
    url,
  });
  return response.body['objects'];
};

const getMd5 = (input: string): string => {
  return crypto.createHash('md5').update(input).digest('hex');
}

pack.addSyncTable({
  name: "Projects",
  description: "List of projects",
  identityName: "Project",
  schema: schemas.ProjectSchema,
  formula: {
    name: "SyncProjects",
    description: "Syncs the project data",
    parameters: [],
    execute: async function ([], context) {
      const response = await context.fetcher.fetch({
        method: "GET",
        url: 'https://api.braintrustdata.com/v1/project/',
      });
  
      return {
        result: response.body['objects'],
      }
    }
  },
});

pack.addSyncTable({
  name: "Experiments",
  description: "List of experiments",
  identityName: "Experiment",
  schema: schemas.ExperimentSchema,
  formula: {
    name: "SyncExperiments",
    description: "Syncs the experiment data",
    parameters: [
      coda.makeParameter({
        type: coda.ParameterType.String,
        name: "projectName",
        description: "The project you would like to get experiments from.",
        optional: true,
      }),
    ],
    execute: async function ([projectName], context) {
      return {
        result: await getExperiments(context, projectName),
      }
    }
  },
});

pack.addSyncTable({
  name: "Datasets",
  description: "List of datasets",
  identityName: "Dataset",
  schema: schemas.DatasetSchema,
  formula: {
    name: "SyncDatasets",
    description: "Syncs the data",
    parameters: [],
    execute: async function ([], context) {
      const response = await context.fetcher.fetch({
        method: "GET",
        url: 'https://api.braintrustdata.com/v1/dataset',
      });

      const datasets = response.body['objects'];

      for (let i = 0; i < datasets.length; ++i) {
        // @NOTE: Added project name to each dataset record, making easier to figure out which project
        // the dataset is from.
        datasets[i]['project_name'] = (await getProject(datasets[i]['project_id'], context)).name;
      }

      return {
        result: datasets,
      }
    }
  },
});

pack.addFormula({
  name: "GetExperimentSummary",
  description: "Get summary of an experiment",
  isAction: false,
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "experimentId",
      description: "The ID of the experiment you would like to summarize.",
      optional: false,
    }),
  ],

  resultType: coda.ValueType.Object,
  schema: schemas.ExperimentSummarySchema,

  execute: async function ([experimentId], context) {
    const experimentSummary = await getExperimentSummary(experimentId, context);

    if (experimentSummary.scores) {
      experimentSummary.scores = Object.values(experimentSummary.scores);
    }
    if (experimentSummary.metrics) {
      experimentSummary.metrics = Object.values(experimentSummary.metrics);
    }

    return experimentSummary;
  },
});

pack.addFormula({
  name: "GetExperimentScore",
  description: "Get an experiment score by name",
  isAction: false,
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "experimentId",
      description: "The ID of the experiment you would like to fetch.",
      optional: false,
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "scoreName",
      description: "The name of the score.",
      optional: false,
    }),
  ],

  resultType: coda.ValueType.Number,

  execute: async function ([experimentId, scoreName], context) {
    const experimentSummary = await getExperimentSummary(experimentId, context);
    return experimentSummary.scores[scoreName]?.score;
  },
});

const parseBlob = (maybeJsonObject: any): string => {
  try {
    return JSON.parse(maybeJsonObject);
  }
  catch {
    return maybeJsonObject;
  }
};

pack.addFormula({
  name: "UpsertDatasetRow",
  description: "Add/update row in a dataset",
  isAction: true,
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "datasetId",
      description: "The dataset you would like to insert row to.",
      optional: false,
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "input",
      description: "JSON string representation of the input.",
      optional: false,
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "expected",
      description: "JSON string representation of the expected blob.",
      optional: true,
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "metadata",
      description: "JSON string representation of the metadata blob.",
      optional: true,
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "id",
      description: "ID of the row. If not set, If not set, the pack will generate one using `md5(json.stringify(input) + 'dataset ID')`.",
      optional: true,
    }),
    coda.makeParameter({
      type: coda.ParameterType.StringArray,
      name: "tags",
      description: "Tags for the row",
      optional: true,
    }),
  ],

  resultType: coda.ValueType.String,

  execute: async function ([datasetId, input, expected, metadata, id, tags], context) {
    const response = await context.fetcher.fetch({
      method: "POST",
      url: `https://api.braintrustdata.com/v1/dataset/${datasetId}/insert`,
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        events: [
          {
            input: input ? parseBlob(input) : null,
            expected: expected ? parseBlob(expected) : null,
            metadata: metadata ? parseBlob(metadata) : null,
            // @NOTE: Doing the parse -> stringify to eliminate formatting in the incoming JSON blob
            id: id ? id : getMd5(`${datasetId}|${JSON.stringify(parseBlob(input))}`),
            tags: tags ? tags : null,
          },
        ],
      })
    });

    return response.body['row_ids'][0];
  },
});

pack.addSyncTable({
  name: "LatestProjectScores",
  description: "Scores associated with the latest experiment in a project",
  identityName: "ProjectScore",
  schema: schemas.ProjectScoreSchema,
  formula: {
    name: "SyncProjectScores",
    description: "Syncs the data",
    parameters: [
      coda.makeParameter({
        type: coda.ParameterType.String,
        name: "projectName",
        description: "The project you would like to fetch the experiment on.",
        optional: false,
      }),
      coda.makeParameter({
        type: coda.ParameterType.String,
        name: "experimentPrefix",
        description: "Prefix that the experiment must match.",
        optional: true,
      }),
    ],
    execute: async function ([projectName, experimentPrefix], context) {
      const experiments = await getExperiments(context, projectName, 50);

      if (experiments?.length === 0) {
        throw new coda.UserVisibleError(`Unable to locate experiments in project ${projectName}`);
      }
      
      const latestExperiment = experimentPrefix ? experiments.find((exp) => exp.name.startsWith(experimentPrefix)) : experiments[0];

      if (!latestExperiment) {
        throw new coda.UserVisibleError(`Latest experiment for project ${projectName} cannot be found.`);
      }

      const experimentSummary = await getExperimentSummary(latestExperiment.id, context);
      
      const experimentScores = experimentSummary.scores ? Object.values(experimentSummary.scores) : [];

      return {
        result: experimentScores.map((experimentScore: any) => {
          return {
            // Generate a consistent ID for sync table
            project_score_id: getMd5(`${projectName}|${experimentScore.name}`),
            project_name: projectName,
            experiment_name: latestExperiment.name,
            created: latestExperiment.created,
            score_name: experimentScore.name,
            score_value: experimentScore.score,
          };
        }),
      }
    }
  },
});