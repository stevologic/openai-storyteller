import openai

DEBUG = False

class OpenAIStoryTeller:
    def __init__(self, openai_api_key: str):
        """
        Initialize ProResponseOpenAI object with OpenAI API key.
        """
        self.openai_api_key = openai_api_key
        openai.api_key = self.openai_api_key
        self.model = 'text-davinci-003'
        self.max_tokens = 1024
        self.temperature = 1
        self.n = 1
        self.top_p = 0.5
        self.stop = None
        self.frequency_penalty=0.5
        self.presense_penalty=0.5

    def openai_completion(self, prompt_text: str):
        # Make the query to the model
        response = openai.Completion.create(
            model=self.model,
            prompt=prompt_text,
            temperature=self.temperature,
            max_tokens=self.max_tokens,
            n = self.n,
            top_p=self.top_p,
            stop=self.stop,
            frequency_penalty=self.presense_penalty,
            presence_penalty=self.presense_penalty
        )
        # Randomize answers, then select one
        answer = response['choices'][0]['text']
        return answer

    def openai_image(self, description: str):
        prompt_text = f'''
        Ultra realistic; HD; 4k; picture of
        {description}
        '''
        # Make the query to the model
        response = openai.Image.create(
            prompt=prompt_text,
            n=1,
            size="1024x1024",
            response_format="url"
        )
        # Randomize answers, then select one
        image_url = response['data'][0]['url']
        return image_url

    def generate_story(self, number_of_paragraphs: int, plot: str):
        intruction = f'''
        Generate a {number_of_paragraphs} paragraph story on the following plot.

        plot:
        '''
        # Create the question to OpenAI
        prompt_text = f'{intruction}\n\n{plot}.'
        story = self.openai_completion(prompt_text)
        print(f'OpenAI generated story: {story}') if DEBUG else ''
        return story

    def generate_title(self, story: str):
        intruction = '''
        Generate a short book title given the following story:

        story:
        '''
        # Create the question to OpenAI
        prompt_text = f'{intruction}\n\n{story}.'
        title = self.openai_completion(prompt_text).replace('"','')
        print(f'Title: {title}') if DEBUG else ''
        return title

    def generate_page_header(self, description: str):
        intruction = '''
        Generate a page header in little words foreshadowing what's about to happen in the following description without using character names. Don't use words like "the" or "a".

        description:
        '''
        # Create the question to OpenAI
        prompt_text = f'{intruction}\n\n{description}.'
        header = self.openai_completion(prompt_text).strip('.')
        print(f'Page Header: {header}') if DEBUG else ''
        return header




    

if __name__ == '__main__':
    # Load environment variables from .env file
    import os
    from dotenv import load_dotenv
    load_dotenv()

    # Initialize ProResponseOpenAI object with OpenAI API key from environment variable
    ai = OpenAIStoryTeller(
        openai_api_key=os.getenv('OPENAI_API_KEY')
    )

    # Gather user input
    plot = input('Enter a plot: ')
    paragraph_count = input("Enter number of paragraphs: ")

    # Query OpenAI for completion of user input
    response = ai.generate_story(paragraph_count, plot)
    title = ai.generate_title(response)

    print(title)
    print(response)
