export type ConnectionType = 'direct' | 'stun' | 'relay';

export interface ConnectionRouteSnapshot {
  connectionType: ConnectionType;
  localCandidateType?: string;
  remoteCandidateType?: string;
  rtt?: number;
}

export interface ConnectionRouteInfo {
  shortLabel: string;
  label: string;
  description: string;
  serverRole: string;
}

type StatsRecord = RTCStats & Record<string, unknown>;

export const CONNECTION_ROUTE_INFO: Record<ConnectionType, ConnectionRouteInfo> = {
  direct: {
    shortLabel: 'Direct WiFi',
    label: 'Direct WiFi',
    description: 'ไฟล์วิ่งตรงระหว่างเครื่อง',
    serverRole: 'Server ใช้แค่จับคู่',
  },
  stun: {
    shortLabel: 'P2P',
    label: 'P2P Internet',
    description: 'ส่งตรงผ่าน WebRTC',
    serverRole: 'Server ใช้แค่จับคู่',
  },
  relay: {
    shortLabel: 'Relay',
    label: 'Server Relay',
    description: 'Fallback ผ่าน server',
    serverRole: 'ไฟล์ผ่าน server',
  },
};

export function getConnectionRouteInfo(connectionType?: ConnectionType): ConnectionRouteInfo | null {
  return connectionType ? CONNECTION_ROUTE_INFO[connectionType] : null;
}

export function classifyCandidatePair(localType?: string, remoteType?: string): ConnectionType {
  if (localType === 'relay' || remoteType === 'relay') return 'relay';
  if (localType === 'srflx' || remoteType === 'srflx') return 'stun';
  return 'direct';
}

export function getSelectedConnectionRoute(stats: RTCStatsReport): ConnectionRouteSnapshot | null {
  let selectedPair: StatsRecord | undefined;

  stats.forEach((report) => {
    const candidatePair = report as StatsRecord;
    if (
      candidatePair.type === 'candidate-pair' &&
      candidatePair.selected === true &&
      candidatePair.state === 'succeeded'
    ) {
      selectedPair = candidatePair;
    }
  });

  if (!selectedPair) {
    stats.forEach((report) => {
      const transport = report as StatsRecord;
      if (transport.type !== 'transport' || typeof transport.selectedCandidatePairId !== 'string') return;
      const pair = stats.get(transport.selectedCandidatePairId) as StatsRecord | undefined;
      if (pair?.type === 'candidate-pair') {
        selectedPair = pair;
      }
    });
  }

  if (!selectedPair) {
    stats.forEach((report) => {
      const candidatePair = report as StatsRecord;
      if (
        !selectedPair &&
        candidatePair.type === 'candidate-pair' &&
        candidatePair.state === 'succeeded'
      ) {
        selectedPair = candidatePair;
      }
    });
  }

  if (!selectedPair) return null;

  const localCandidate = typeof selectedPair.localCandidateId === 'string'
    ? stats.get(selectedPair.localCandidateId) as StatsRecord | undefined
    : undefined;
  const remoteCandidate = typeof selectedPair.remoteCandidateId === 'string'
    ? stats.get(selectedPair.remoteCandidateId) as StatsRecord | undefined
    : undefined;

  const localCandidateType = typeof localCandidate?.candidateType === 'string'
    ? localCandidate.candidateType
    : undefined;
  const remoteCandidateType = typeof remoteCandidate?.candidateType === 'string'
    ? remoteCandidate.candidateType
    : undefined;
  const currentRoundTripTime = typeof selectedPair.currentRoundTripTime === 'number'
    ? Math.round(selectedPair.currentRoundTripTime * 1000)
    : undefined;

  return {
    connectionType: classifyCandidatePair(localCandidateType, remoteCandidateType),
    localCandidateType,
    remoteCandidateType,
    rtt: currentRoundTripTime,
  };
}
