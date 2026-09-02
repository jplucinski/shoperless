export function CartButton(props: { sku: string }) {
  return (
    <a href={`/cart?add=${encodeURIComponent(props.sku)}`} className="shop-btn no-underline">
      Do koszyka
    </a>
  );
}
