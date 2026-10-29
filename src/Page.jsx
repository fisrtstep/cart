import { useEffect, useState } from 'react';
import {
    Alert,
    Badge,
    Button,
    Card,
    EmptyState,
    formatPrice,
    PageHeader,
    Price,
    QuantityStepper,
    Spinner,
    toast,
    useCart,
} from 'host/ui';

const API = 'https://fakestoreapi.com';

/**
 * Cart page — host should pass { token, userId, username }.
 * "Your bag" is the shared cart store (filled by the catalog MFE).
 * "Order history" fetches GET /carts/user/:userId, then resolves product titles.
 */
export function Page({ token, userId, username }) {
    return (
        <section className="space-y-8">
            <PageHeader
                title="Cart"
                subtitle={
                    (username
                        ? `Cart for ${username} (user #${userId})`
                        : 'User cart from Fake Store') +
                    (token ? '' : ' · no token passed yet')
                }
            />
            <Bag userId={userId} />
            <OrderHistory userId={userId} />
        </section>
    );
}

function Bag({ userId }) {
    const { items, count, total, setQuantity, remove, clear } = useCart();
    const [submitting, setSubmitting] = useState(false);

    const checkout = () => {
        setSubmitting(true);
        fetch(`${API}/carts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: Number(userId),
                products: items.map((i) => ({ id: i.productId, quantity: i.quantity })),
            }),
        })
            .then((res) => {
                if (!res.ok) throw new Error(`Checkout failed (${res.status})`);
                return res.json();
            })
            .then((order) => {
                clear();
                toast(`Order #${order.id} placed`);
            })
            .catch((err) => toast(err.message || 'Checkout failed', 'error'))
            .finally(() => setSubmitting(false));
    };

    return (
        <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                Your bag {count > 0 && <Badge tone="brand">{count}</Badge>}
            </h3>

            {items.length === 0 ? (
                <EmptyState
                    title="Your bag is empty"
                    body="Add products from the Catalog and they will show up here."
                />
            ) : (
                <>
                    <Card as="ul" className="divide-y divide-slate-200">
                        {items.map((item) => (
                            <li key={item.productId} className="flex flex-wrap items-center gap-4 px-4 py-3">
                                <Thumb image={item.image} title={item.title} />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-slate-900">
                                        {item.title}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        {formatPrice(item.price)} each
                                    </p>
                                </div>
                                <QuantityStepper
                                    value={item.quantity}
                                    onChange={(q) => setQuantity(item.productId, q)}
                                />
                                <Price
                                    value={Number(item.price) * item.quantity}
                                    className="w-20 text-right text-sm"
                                />
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    aria-label={`Remove ${item.title}`}
                                    onClick={() => remove(item.productId)}
                                >
                                    Remove
                                </Button>
                            </li>
                        ))}
                    </Card>
                    <div className="flex flex-wrap items-center justify-end gap-3">
                        <p className="mr-auto text-base text-slate-700">
                            Total: <Price value={total} />
                        </p>
                        <Button variant="secondary" onClick={clear} disabled={submitting}>
                            Clear
                        </Button>
                        <Button onClick={checkout} loading={submitting} disabled={userId == null}>
                            Checkout
                        </Button>
                    </div>
                </>
            )}
        </div>
    );
}

function OrderHistory({ userId }) {
    const [lines, setLines] = useState([]);
    const [status, setStatus] = useState('idle');
    const [error, setError] = useState('');

    useEffect(() => {
        if (userId == null || userId === '') {
            setStatus('need-user');
            setLines([]);
            return;
        }

        let cancelled = false;
        setStatus('loading');
        setError('');

        Promise.all([
            fetch(`${API}/carts/user/${userId}`).then((res) => {
                if (!res.ok) throw new Error(`Cart request failed (${res.status})`);
                return res.json();
            }),
            fetch(`${API}/products`).then((res) => {
                if (!res.ok) throw new Error(`Products request failed (${res.status})`);
                return res.json();
            }),
        ])
            .then(([carts, products]) => {
                if (cancelled) return;

                const byId = new Map(
                    (Array.isArray(products) ? products : []).map((p) => [p.id, p]),
                );

                const next = [];
                for (const cart of Array.isArray(carts) ? carts : []) {
                    for (const item of cart.products || []) {
                        const product = byId.get(item.productId);
                        next.push({
                            key: `${cart.id}-${item.productId}`,
                            cartId: cart.id,
                            productId: item.productId,
                            quantity: item.quantity,
                            title: product?.title ?? `Product #${item.productId}`,
                            price: product?.price ?? null,
                            image: product?.image ?? null,
                        });
                    }
                }

                setLines(next);
                setStatus('ready');
            })
            .catch((err) => {
                if (cancelled) return;
                setError(err.message || 'Failed to load cart');
                setStatus('error');
            });

        return () => {
            cancelled = true;
        };
    }, [userId]);

    const total = lines.reduce((sum, line) => {
        if (line.price == null) return sum;
        return sum + Number(line.price) * Number(line.quantity);
    }, 0);

    return (
        <div className="space-y-3">
            <h3 className="text-lg font-semibold text-slate-900">Order history</h3>

            {status === 'need-user' && (
                <Alert tone="warning">
                    Pass a <code className="font-mono">userId</code> prop from the host
                    (decoded JWT <code className="font-mono">sub</code>) to load this cart.
                </Alert>
            )}

            {status === 'loading' && <Spinner label="Loading cart…" />}

            {status === 'error' && <Alert tone="error">{error}</Alert>}

            {status === 'ready' && lines.length === 0 && (
                <EmptyState title="No past orders" />
            )}

            {status === 'ready' && lines.length > 0 && (
                <>
                    <Card as="ul" className="divide-y divide-slate-200">
                        {lines.map((line) => (
                            <li key={line.key} className="flex items-center gap-4 px-4 py-3">
                                <Thumb image={line.image} title={line.title} />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-slate-900">
                                        {line.title}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        Order #{line.cartId} · Qty {line.quantity}
                                        {line.price != null
                                            ? ` · ${formatPrice(line.price)} each`
                                            : ''}
                                    </p>
                                </div>
                                {line.price != null && (
                                    <Price
                                        value={Number(line.price) * Number(line.quantity)}
                                        className="text-sm"
                                    />
                                )}
                            </li>
                        ))}
                    </Card>
                    <p className="text-right text-base text-slate-700">
                        Historic total: <Price value={total} />
                    </p>
                </>
            )}
        </div>
    );
}

function Thumb({ image, title }) {
    return (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-slate-50 p-2">
            {image ? (
                <img src={image} alt={title} className="max-h-full max-w-full object-contain" />
            ) : (
                <span className="text-xs text-slate-400">N/A</span>
            )}
        </div>
    );
}

export default Page;
