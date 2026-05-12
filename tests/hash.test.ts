import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    sha1,
    tokenIniciarTransaccion,
    tokenConsultarPedido,
    tokenPagoRecurrente,
    tokenWebhook,
} from '../src/hash.js';
import { PagoparClient } from '../src/client.js';

const PRIV = 'comercio_token_privado_demo';
const PUB = '63820974a40fe7c5c5c53c429af8b25bed599dbf';

test('sha1 hash hex', () => {
    assert.equal(sha1('hola'), '99800b85d3383e3a2fb45eb7d0066a4879a9dad0');
});

test('tokenIniciarTransaccion replica floatval de PHP', () => {
    // sha1(priv + "PED-1" + "100000")
    const expected = sha1(`${PRIV}PED-1100000`);
    assert.equal(tokenIniciarTransaccion(PRIV, 'PED-1', 100_000), expected);
});

test('tokens fijos de pagopar', () => {
    assert.equal(tokenConsultarPedido(PRIV), sha1(`${PRIV}CONSULTA`));
    assert.equal(tokenPagoRecurrente(PRIV), sha1(`${PRIV}PAGO-RECURRENTE`));
});

test('verifyWebhookSignature acepta firma válida', () => {
    const client = new PagoparClient({ publicKey: PUB, privateKey: PRIV });
    const hash = 'ad57c9c94f745fdd9bc9093bb409297607264af1a904e6300e71c24f15d6ggnn';
    const ok = client.verifyWebhookSignature({
        hash_pedido: hash,
        token: tokenWebhook(PRIV, hash),
    });
    assert.equal(ok, true);
});

test('verifyWebhookSignature rechaza firma inválida', () => {
    const client = new PagoparClient({ publicKey: PUB, privateKey: PRIV });
    const ok = client.verifyWebhookSignature({
        hash_pedido: 'abc',
        token: 'no-coincide',
    });
    assert.equal(ok, false);
});

test('checkoutUrl con y sin forma_pago', () => {
    const c = new PagoparClient({ publicKey: PUB, privateKey: PRIV });
    assert.equal(c.checkoutUrl('xyz'), 'https://www.pagopar.com/pagos/xyz');
    assert.equal(
        c.checkoutUrl('xyz', 9),
        'https://www.pagopar.com/pagos/xyz?forma_pago=9',
    );
});
