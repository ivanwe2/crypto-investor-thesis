package exchange

type CombinedStreamEvent struct {
	Stream string       `json:"stream"`
	Data   BinanceTrade `json:"data"`
}

type BinanceTrade struct {
	EventType string `json:"e"`
	EventTime int64  `json:"E"`
	Symbol    string `json:"s"`
	Price     string `json:"p"`
	Quantity  string `json:"q"`
	TradeTime int64  `json:"T"`
}
