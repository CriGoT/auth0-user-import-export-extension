import axios from 'axios';
import uuid from 'node-uuid';
import * as constants from '../constants';
import promiseWhile from '../utils/promiseWhile';

export function addColumn(name, exportAs) {
  return {
    type: constants.ADD_COLUMN,
    payload: {
      _id: uuid.v4(),
      name,
      export_as: exportAs
    }
  };
}

export function removeColumn(id) {
  return {
    type: constants.REMOVE_COLUMN,
    payload: {
      _id: id
    }
  };
}

export function updateSearchFilter(searchFilter) {
  return {
    type: constants.UPDATE_SEARCH_FILTER,
    payload: {
      searchFilter
    }
  };
}

export function updateSettings(settings) {
  return {
    type: constants.UPDATE_SETTINGS,
    payload: {
      settings
    }
  };
}

export function getUserCount(connection) {
  let url = `https://${window.config.AUTH0_DOMAIN}/api/v2/users?per_page=1&page=1&include_totals=true&search_engine=v1`;

  if (connection) {
    url += `&connection=${connection}`
  }

  return {
    type: constants.FETCH_USER_COUNT,
    payload: {
      promise: axios.get(url, {
        responseType: 'json'
      })
    }
  };
}

function createJob(settings = {}) {
  let url = `https://${window.config.AUTH0_DOMAIN}/api/v2/jobs/users-exports`;

  return axios
    .post(url, settings)
    .then(res => res && res.data && res.data.id);
}

function checkJob(id) {
  let url = `https://${window.config.AUTH0_DOMAIN}/api/v2/jobs/${id}`;

  return axios
    .get(url)
    .then(res => res);
}

export function closeExportDialog() {
  return {
    type: constants.CLOSE_EXPORT_DIALOG
  };
}

export function downloadUsersToFile(link) {
  window.location = link;
  return closeExportDialog();
}

export function exportUsers(settings, fields) {
  return (dispatch, getState) => {
    // Start.
    dispatch({
      type: constants.EXPORT_USERS_STARTED
    });

    let done = false;
    let link = '';

    if (fields && fields.length) {
      settings.fields = fields.map(field => ({ name: field.name, export_as: field.export_as }));
    }

    createJob(settings)
      .then(jobId => {
        promiseWhile(() => !done,
          () => checkJob(jobId).then(res => {
            const data = (res && res.data) || {};
            if (!getState().export.get('process').get('started')) {
              done = true;
              return;
            }

            if (data.status === 'completed') {
              done = true;
              link = data.location;
            }

            // Report progress.
            dispatch({
              type: constants.EXPORT_USERS_PROGRESS,
              payload: {
                percentage: data.percentage_done || 0
              }
            });
          }))
          .then(() => {
            if (!getState().export.get('process').get('started')) {
              return;
            }
            // Report progress.
            dispatch({
              type: constants.EXPORT_USERS_COMPLETE,
              payload: {
                link,
                percentage: 100
              }
            });
          });
      });
  };
}
