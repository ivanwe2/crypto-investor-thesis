namespace TradeEngine.Domain.Shared;

public record Money(decimal Amount, string Currency)
{
    public static Money Zero(string currency) => new(0, currency);

    public static Money operator +(Money a, Money b)
    {
        return a.Currency != b.Currency
            ? throw new InvalidOperationException("Currencies do not match")
            : new(a.Amount + b.Amount, a.Currency);
    }

    public static Money operator -(Money a, Money b)
    {
        return a.Currency != b.Currency
            ? throw new InvalidOperationException("Currencies do not match")
            : new(a.Amount - b.Amount, a.Currency);
    }
}
