import { get, flow, isNumber, isUndefined } from 'lodash/fp';
import { hexToNumber, numberToHex } from '../common';

const always = value => value;
const defaultMethod = async (
  provider,
  methodName,
  customFormat = always,
  params = []
) => {
  const payload = {
    method: methodName,
    params
  };
  const result = await provider.request(payload);
  return parseResult(result, customFormat);
};

const getBlockNumber = async (provider, blockNumber) => {
  const payload = {
    method: 'kai_getBlockByNumber',
    params: [blockNumber]
  };
  const result = await provider.request(payload);
  return parseResult(result, always);
};

const getBlockByHash = async (provider, blockHash) => {
  const payload = {
    method: 'kai_getBlockByHash',
    params: [blockHash]
  };
  const result = await provider.request(payload);
  return parseResult(result, always);
};

const parseResult = (result, customFormat) => {
  if (!isUndefined(get('data.result', result))) {
    return flow(
      get('data.result'),
      customFormat
    )(result);
  } else {
    throw new Error(JSON.stringify(result.data));
  }
};

const sendSignedTx = async (
  provider,
  rawTx,
  waitUntilMine = false,
  timeout = 30000
) => {
  const txHash = await defaultMethod(
    provider,
    'tx_sendRawTransaction',
    always,
    [rawTx]
  );
  const submittedHash = parseResult(txHash, always);
  if (waitUntilMine === false) {
    return submittedHash;
  }

  const breakTimeout = Date.now() + timeout;
  while (Date.now < breakTimeout) {
    const receipt = await defaultMethod(
      provider,
      'tx_getTransactionReceipt',
      always,
      [submittedHash]
    );
    if (receipt) {
      return receipt;
    } else {
      await sleep(1000);
    }
  }
  throw new Error(`Timeout: cannot get receipt after ${timeout}ms`);
};

export default provider => {
  return {
    clientVerion: () => defaultMethod(provider, 'node_nodeName'),
    // isProposer: () => defaultMethod(provider, 'kai_proposer'),
    peerCount: () => defaultMethod(provider, 'node_peersCount'),
    votingPower: () => defaultMethod(provider, 'kai_votingPower'),
    blockNumber: () => defaultMethod(provider, 'kai_blockNumber'),
    pendingTransaction: () => defaultMethod(provider, 'tx_pendingTransactions'),
    blockByNumber: blockNum => getBlockNumber(provider, blockNum),
    blockByHash: blockHash => getBlockByHash(provider, blockHash),
    transactionCount: (address, blockParam = 'latest') =>
      defaultMethod(provider, 'kai_getTransactionCount', hexToNumber, [
        address,
        blockParam
      ]),
    sendSignedTransaction: (rawTx, waitUntilMine = false, timeout) =>
      sendSignedTx(provider, rawTx, (waitUntilMine = false), timeout),
    transactionByHash: txHash =>
      defaultMethod(provider, 'tx_getTransaction', always, [txHash]),
    transactionReceipt: txHash =>
      defaultMethod(provider, 'tx_getTransactionReceipt', always, [txHash]),
    balance: address =>
      defaultMethod(provider, 'account_balance', always, [address])
  };
};
