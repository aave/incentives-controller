import { DefenderRelaySigner, DefenderRelayProvider } from 'defender-relay-client/lib/ethers';

export const getDefenderRelaySigner = async () => {
  const { DEFENDER_API_KEY, DEFENDER_SECRET_KEY } = process.env;

  if (!DEFENDER_API_KEY || !DEFENDER_SECRET_KEY) {
    throw new Error('Defender secrets required');
  }

  const credentials = { apiKey: DEFENDER_API_KEY, apiSecret: DEFENDER_SECRET_KEY };
  const signer = new DefenderRelaySigner(credentials, new DefenderRelayProvider(credentials), {
    speed: 'fast',
  });
  const address = await signer.getAddress();

  return { signer, address };
};
