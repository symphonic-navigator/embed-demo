"""Sentences for validate.py: multilingual passages and queries with a known best match."""

PASSAGES = [
    "猫が日向で眠っている。",                         # 0 cat sleeping (ja)
    "子猫がソファの上で丸くなっている。",               # 1 kitten curled up (ja)
    "明日は雨が降るそうです。",                         # 2 rain tomorrow (ja)
    "この電車は東京駅に止まりますか。",                 # 3 train (ja)
    "税金の申告は三月までです。",                       # 4 tax (ja)
    "Le chat dort sur le canapé.",                      # 5 cat sleeping (fr)
    "J'ai mangé une soupe délicieuse ce soir.",         # 6 food (fr)
    "Der Zug nach Berlin hat zehn Minuten Verspätung.", # 7 train (de)
    "Morgen soll es den ganzen Tag regnen.",            # 8 rain (de)
    "I need to file my tax return by Friday.",          # 9 tax (en)
    "She cooked pasta with fresh tomatoes.",            # 10 food (en)
    "The children are playing football in the park.",  # 11 sport (en)
]

# (query, index of the passage that must rank first)
QUERIES = [
    ("un chat qui dort", 0),
    ("it is going to rain tomorrow", 2),
    ("Ich fahre mit dem Zug nach Tokio", 3),
    ("税金の締め切り", 4),
]
