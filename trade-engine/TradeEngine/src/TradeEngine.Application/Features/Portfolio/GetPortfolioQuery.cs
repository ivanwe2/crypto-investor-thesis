using MediatR;
using TradeEngine.Application.DTOs.Wallet;

namespace TradeEngine.Application.Features.Portfolio;

public record GetPortfolioQuery(Guid UserId) : IRequest<Result<WalletResponse>>;