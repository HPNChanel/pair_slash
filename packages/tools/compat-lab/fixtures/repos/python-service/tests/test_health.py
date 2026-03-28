from service.app import healthcheck


def test_healthcheck():
    assert healthcheck()["status"] == "ok"
