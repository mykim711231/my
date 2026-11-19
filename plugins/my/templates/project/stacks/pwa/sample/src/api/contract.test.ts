import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// REQ-00: 화면이 쓰는 API가 계약에 있어야 한다
const contract = JSON.parse(
  readFileSync(new URL('../../{{contracts}}/openapi.json', import.meta.url), 'utf8'),
);

describe('계약', () => {
  it('getHealth가 있다', () => {
    expect(contract.paths['/health']?.get?.operationId).toBe('getHealth');
  });
});
