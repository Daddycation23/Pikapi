import pandas as pd
import random

class Pokedex:
    def __init__(self, csv_path="data.csv"):
        self.df = pd.read_csv(csv_path, sep='\t', encoding='utf-16')

    def get_random_pokemon(self):
        return self.df.sample(1).iloc[0].to_dict()

    def get_pokemon_by_name(self, name):
        result = self.df[self.df['english_name'].str.lower() == name.lower()]
        return result.iloc[0].to_dict() if not result.empty else None 