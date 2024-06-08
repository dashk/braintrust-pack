import * as coda from "@codahq/packs-sdk";
import * as schemas from "./schemas";
import * as crypto from 'crypto';

// This line creates your new Pack.
export const pack = coda.newPack();

pack.addNetworkDomain("braintrustdata.com");

pack.setUserAuthentication({
  type: coda.AuthenticationType.HeaderBearerToken,
});

const getProjectByName = async (name: string, context: coda.ExecutionContext) => {
  const response = await context.fetcher.fetch({
    method: "GET",
    url: `https://api.braintrustdata.com/v1/project?project_name=${name}`,
  });

  return response.body['objects'][0];
}

const getProject = async (id: string, context: coda.ExecutionContext) => {
  const response = await context.fetcher.fetch({
    method: "GET",
    url: `https://api.braintrustdata.com/v1/project/${id}`,
  });

  return response.body;
};

const upsertDatasetRow = async (
  datasetId: string,
  id: string,
  input: object,
  expected: object,
  metadata: object,
  context: coda.ExecutionContext,
  tags?: string[],
): Promise<string> => {
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
          input,
          expected,
          metadata,
          // @NOTE: Doing the parse -> stringify to eliminate formatting in the incoming JSON blob
          id: id ? id : getMd5(`${datasetId}|${JSON.stringify(input)}`),
          tags: tags ? tags : null,
        },
      ],
    })
  });

  return response.body['row_ids'][0];
}

const deleteDatasetRow = async(id: string, datasetId: string, context: coda.ExecutionContext): Promise<boolean> => {
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
          id,
          "_object_delete": true,
          "_is_merge": true,
        },
      ],
    })
  });

  if (response.status !== 200) {
    throw new coda.UserVisibleError(`Failed to delete row with ID ${id}. Error: ${response.body}`);
  }

  return true;
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

const getExperimentIdByName = async (projectName: string, experimentName: string, context: coda.ExecutionContext) => {
  const response = await context.fetcher.fetch({
    method: "GET",
    url: `https://api.braintrustdata.com/v1/experiment?project_name=${encodeURIComponent(projectName)}&experiment_name=${encodeURIComponent(experimentName)}`,
  });

  const experiments = response.body['objects'];

  if (experiments.length === 0) {
    throw new coda.UserVisibleError(`Unable to locate experiment '${experimentName}' in project '${projectName}'`);
  }

  if (experiments.length > 1) {
    throw new coda.UserVisibleError(`Multiple experiments found with name '${experimentName}' in project '${projectName}'`);
  }

  return experiments[0].id;
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

interface ExperimentLog {
  id: string;
  created: string;
  org_id: string;
  project_id: string;
  experiment_id: string;
  input: Object;
  output: Object;
  expected: Object;
  scores: Record<string, number>;
  metadata: Record<string, any>;
  tags: string[];
}

const getExperimentLogs = async (context: coda.ExecutionContext, projectName: string, experimentName: string, limit: number = 10000): Promise<ExperimentLog[]> => {
  const experimentId = await getExperimentIdByName(projectName, experimentName, context);
  const response = await context.fetcher.fetch({
    method: "GET",
    url: `https://api.braintrustdata.com/v1/experiment/${experimentId}/fetch?limit=${limit}`,
  });

  return response.body['events'];
}

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

const parseBlob = (maybeJsonObject: any, propertyName: string, enforceValidJson: boolean): object => {
  try {
    return JSON.parse(maybeJsonObject);
  }
  catch {
    if (enforceValidJson) {
      throw new coda.UserVisibleError(`Invalid JSON object: ${propertyName}`);
    }
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
    coda.makeParameter({
      type: coda.ParameterType.Boolean,
      name: "enforceValidJson",
      description: "If true, the input, expected, and metadata must be valid JSON objects. Default to false.",
      optional: true,
    }),
  ],

  resultType: coda.ValueType.String,

  execute: async function ([datasetId, input, expected, metadata, id, tags, enforceValidJson], context) {
    const insertedRowId = upsertDatasetRow(
      datasetId,
      id,
      parseBlob(input, 'input', enforceValidJson),
      parseBlob(expected, 'expected', enforceValidJson),
      parseBlob(metadata, 'metadata', enforceValidJson),
      context,
      tags,
    );

    return insertedRowId;
  },
});

pack.addFormula({
  name: "DeleteDatasetRow",
  description: "Deletes a row from a dataset",
  isAction: true,
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "id",
      description: "ID of the row",
      optional: false,
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "datasetId",
      description: "The dataset you would like to insert row to.",
      optional: false,
    }),
  ],

  resultType: coda.ValueType.Boolean,

  execute: async function ([id, datasetId], context) {
    return await deleteDatasetRow(id, datasetId, context);
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

pack.addSyncTable({
  name: "ExperimentLogs",
  description: "Logs of an experiment",
  identityName: "ExperimentLog",
  schema: schemas.ExperimentLogSchema,
  formula: {
    name: "SyncExperimentLogs",
    description: "Syncs the experiment log",
    parameters: [
      coda.makeParameter({
        type: coda.ParameterType.String,
        name: "projectName",
        description: "The project you would like to fetch the experiment on.",
        optional: false,
      }),
      coda.makeParameter({
        type: coda.ParameterType.String,
        name: "experimentName",
        description: "The experiment you would like to fetch the logs from.",
        optional: false,
      }),
      coda.makeParameter({
        type: coda.ParameterType.Number,
        name: "limit",
        description: "The number of logs to fetch. Default to 10000",
        optional: true,
      }),
    ],
    execute: async function ([projectName, experimentName, limit], context) {
      const experimentLogs = await getExperimentLogs(context, projectName, experimentName, limit);
      return {
        result: experimentLogs.map((experimentLog: ExperimentLog) => {
          return {
            experiment_log_id: experimentLog.id,
            created: experimentLog.created,
            project_id: experimentLog.project_id,
            experiment_id: experimentLog.experiment_id,
            inputStr: JSON.stringify(experimentLog.input),
            outputStr: JSON.stringify(experimentLog.output),
            expectedStr: JSON.stringify(experimentLog.expected),
            scoresStr: JSON.stringify(experimentLog.scores),
            metadataStr: JSON.stringify(experimentLog.metadata),
          };
        }),
      }
    }
  },
});

