def pokemon_name_to_filename(name):
    filename = name.lower()
    filename = filename.replace("♀", "-f")  # Female symbol
    filename = filename.replace("♂", "-m")  # Male symbol
    filename = filename.replace("'", "")    # Remove apostrophes
    filename = filename.replace(".", "-")   # Replace periods with hyphens
    filename = filename.replace(" ", "-")   # Replace spaces with hyphens
    filename = filename.replace("deoxys", "deoxys-normal") # Special pokemon cases
    filename = filename.replace("mr--mime", "mr-mime") # Special pokemon cases
    return filename 