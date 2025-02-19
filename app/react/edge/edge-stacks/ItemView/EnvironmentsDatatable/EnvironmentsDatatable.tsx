import { useCurrentStateAndParams } from '@uirouter/react';
import { HardDrive } from 'lucide-react';
import { useMemo, useState } from 'react';

import { EdgeStackStatus, StatusType } from '@/react/edge/edge-stacks/types';
import { useEnvironmentList } from '@/react/portainer/environments/queries';
import { useParamState } from '@/react/hooks/useParamState';
import { EnvironmentId } from '@/react/portainer/environments/types';

import { Datatable } from '@@/datatables';
import { useTableStateWithoutStorage } from '@@/datatables/useTableState';
import { PortainerSelect } from '@@/form-components/PortainerSelect';

import { useEdgeStack } from '../../queries/useEdgeStack';

import { EdgeStackEnvironment } from './types';
import { columns } from './columns';

export function EnvironmentsDatatable() {
  const {
    params: { stackId },
  } = useCurrentStateAndParams();
  const edgeStackQuery = useEdgeStack(stackId, {
    refetchInterval(data) {
      if (!data) {
        return 0;
      }

      return Object.values(data.Status).some((status) =>
        status.Status.every((s) => s.Type === StatusType.Running)
      )
        ? 0
        : 10000;
    },
  });

  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useParamState<StatusType>(
    'status',
    (value) => (value ? parseInt(value, 10) : undefined)
  );
  const tableState = useTableStateWithoutStorage('name');
  const endpointsQuery = useEnvironmentList({
    pageLimit: tableState.pageSize,
    page: page + 1,
    search: tableState.search,
    sort: tableState.sortBy.id as 'Group' | 'Name',
    order: tableState.sortBy.desc ? 'desc' : 'asc',
    edgeStackId: stackId,
    edgeStackStatus: statusFilter,
  });

  const currentFileVersion =
    edgeStackQuery.data?.StackFileVersion?.toString() || '';
  const gitConfigURL = edgeStackQuery.data?.GitConfig?.URL || '';
  const gitConfigCommitHash = edgeStackQuery.data?.GitConfig?.ConfigHash || '';
  const environments: Array<EdgeStackEnvironment> = useMemo(
    () =>
      endpointsQuery.environments.map(
        (env) =>
          ({
            ...env,
            TargetFileVersion: currentFileVersion,
            GitConfigURL: gitConfigURL,
            TargetCommitHash: gitConfigCommitHash,
            StackStatus: getEnvStackStatus(
              env.Id,
              edgeStackQuery.data?.Status[env.Id]
            ),
          } satisfies EdgeStackEnvironment)
      ),
    [
      currentFileVersion,
      edgeStackQuery.data?.Status,
      endpointsQuery.environments,
      gitConfigCommitHash,
      gitConfigURL,
    ]
  );

  return (
    <Datatable
      columns={columns}
      isLoading={endpointsQuery.isLoading}
      dataset={environments}
      settingsManager={tableState}
      title="Environments Status"
      titleIcon={HardDrive}
      onPageChange={setPage}
      totalCount={endpointsQuery.totalCount}
      emptyContentLabel="No environment available."
      disableSelect
      description={
        <div className="w-1/4">
          <PortainerSelect<StatusType | undefined>
            isClearable
            bindToBody
            value={statusFilter}
            onChange={(e) => setStatusFilter(e ?? undefined)}
            options={[
              { value: StatusType.Pending, label: 'Pending' },
              { value: StatusType.Acknowledged, label: 'Acknowledged' },
              { value: StatusType.ImagesPulled, label: 'Images pre-pulled' },
              { value: StatusType.Running, label: 'Deployed' },
              { value: StatusType.Error, label: 'Failed' },
            ]}
          />
        </div>
      }
    />
  );
}

function getEnvStackStatus(
  envId: EnvironmentId,
  envStatus: EdgeStackStatus | undefined
) {
  const pendingStatus = {
    Type: StatusType.Pending,
    Error: '',
    Time: new Date().valueOf() / 1000,
  };

  let status = envStatus;
  if (!status) {
    status = {
      EndpointID: envId,
      DeploymentInfo: {
        ConfigHash: '',
        FileVersion: 0,
      },
      Status: [],
    };
  }

  if (status.Status.length === 0) {
    status.Status.push(pendingStatus);
  }

  return status;
}
