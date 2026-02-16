import { useState } from 'react';

interface BidFormProps {
  onSubmit: (healthyPrice: number, sickPrice: number) => void;
  hasBid: boolean;
  disabled?: boolean;
}

export function BidForm({ onSubmit, hasBid, disabled }: BidFormProps) {
  const [healthyPrice, setHealthyPrice] = useState(50);
  const [sickPrice, setSickPrice] = useState(85);

  const handleSubmit = () => {
    if (healthyPrice >= 1 && sickPrice >= 1) {
      onSubmit(healthyPrice, sickPrice);
    }
  };

  if (hasBid) {
    return (
      <div className="ins-bid-form bid-submitted">
        <p>Bid submitted! Waiting for others...</p>
      </div>
    );
  }

  return (
    <div className="ins-bid-form">
      <h3>Set Your Prices</h3>
      <div className="bid-inputs">
        <div className="bid-input-group">
          <label>Healthy Price</label>
          <input
            type="number"
            min={1}
            max={999}
            value={healthyPrice}
            onChange={(e) => setHealthyPrice(Number(e.target.value))}
            disabled={disabled}
          />
          <span className="cost-hint">Cost: $40</span>
        </div>
        <div className="bid-input-group">
          <label>Sick Price</label>
          <input
            type="number"
            min={1}
            max={999}
            value={sickPrice}
            onChange={(e) => setSickPrice(Number(e.target.value))}
            disabled={disabled}
          />
          <span className="cost-hint">Cost: $70</span>
        </div>
      </div>
      <button className="confirm-btn" onClick={handleSubmit} disabled={disabled}>
        Submit Bid
      </button>
    </div>
  );
}
