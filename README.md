# categoraize


categorAIze - Use local AI models to categorize financial transactions


Large Language Models (LLMs) can provide significant help when analyzing financial transactions. Sorting transactions into categories is important for proper accounting and tax purposes. However, sending your personal financial data to large corporations is not ideal. 

This is a node.js app which runs in tandem with a locally running model with ollama. It takes in a raw csv file (probably downloaded from a financial institution), a config file, and a list of allowable categories. The locally running llm will then use the available information as well as the existing list of transactions and their category to make a best guess on which category the new transactions should fit in. 

With all their expenses in context, users can also provide any other financial information (ie, approximate income, retirement dates, assets, etc) and ask questions about their personal financial situation. 

Users can choose different LLMs for the underlying analysis. 
