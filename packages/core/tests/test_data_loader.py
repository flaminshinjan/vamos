def test_loads_everything(loader):
    assert len(loader.market_snapshot.stocks) > 0
    assert len(loader.market_snapshot.sector_performance) > 0
    assert len(loader.news) > 0
    assert len(loader.portfolios) == 3


def test_portfolios_parse(loader):
    for pid in loader.list_portfolio_ids():
        p = loader.get_portfolio(pid)
        assert p.portfolio_id == pid
        assert p.holdings is not None


def test_news_lookup(loader):
    banking_news = loader.news_for_sector("BANKING")
    hdfc_news = loader.news_for_stock("HDFCBANK")
    assert len(banking_news) > 0
    assert len(hdfc_news) > 0
