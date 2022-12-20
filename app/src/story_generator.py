import os
from src.openai_stories import OpenAIStoryTeller

DEBUG = False

class StoryObjectGenerator:
    """
    The goal of this class is to build a story object which can be used to render in HTML/CSS/Javascript

    Ojbect Example:
    {
        "title_page": {
            "title": "My Awesome Story",
            "img": "http://..."
        },
        "pages": [
            {
                "header": "It was a lovely day until it wasn't.",
                "page_text": "It was a lovely day until it wasn't. The sun was shining and there was a gentle breeze in the air. The birds were chirping and the flowers were blooming.",
                "img": "http://..."
            }
        ],
        "the_end": {
            "img": "http://..."
        }    
    }

    """
    def __init__(self, plot='', story=''):
        self.ai = OpenAIStoryTeller(openai_api_key=os.getenv('OPENAI_API_KEY'))
        self.number_of_paragraphs   = 5
        self.page_count             = 5
        self.paragraphs_per_page    = int(self.number_of_paragraphs / self.page_count)
        self.plot                   = plot
        self.story                  = story
        self.story_object = {
            "plot": self.plot,
            "title_page": {},
            "pages": [],
            "the_end": {}
        }

    def generate_story(self):
        self.story = self.ai.generate_story(self.number_of_paragraphs, self.plot)
        print(f'Generated story: {self.story}') if DEBUG else ''

    def generate_story_object(self):
        # Generate Story Oject using OpenAI
        self.generate_title_page()
        for page_text in self.divide_pages():
            self.generate_story_page(page_text)
        self.generate_the_end_page()
        print(f'Generated story_object:\n\n{self.story_object}') if DEBUG else ''

    def divide_pages(self):
        story_paragraph_split = list(filter(None, self.story.split('\n\n')))
        print(f'starting story_paragraph_split length: {len(story_paragraph_split)}') if DEBUG else ''
        story_page_list = [] # Build this, then return it
        for _ in range(self.page_count):
            page_text = "" # Build this with multiple paragraphs as defined in self.paragraphs_per_page
            # for x paragraphs pop an item from the list and add it
            for _ in range(self.paragraphs_per_page):
                if story_paragraph_split:
                    page_text = page_text + f'\n\n {story_paragraph_split.pop(0)}'
                else:
                    break
            story_page_list.append(page_text) # Where the magic is happening
            if not story_paragraph_split:
                break
        if DEBUG:
            for item in story_page_list:
                print(f'Story page item: {item}')
            
        return story_page_list


    def generate_title_page(self):
        self.title = self.ai.generate_title(self.story)
        self.title_img = self.ai.openai_image(self.title)
        self.story_object['title_page'] = {
            "title": self.title,
            "img": self.title_img
        }

    def generate_story_page(self, page_text):
        print(f'Page Text: {page_text}') if DEBUG else ''
        self.story_page_header = self.ai.generate_page_header(page_text)
        self.story_page_img = self.ai.openai_image(page_text)
        self.story_object['pages'].append({
            "header": self.story_page_header,
            "page_text": page_text,
            "img": self.story_page_img
        })

    def generate_the_end_page(self):
        self.the_end_image = self.ai.openai_image(self.story_page_header)
        self.story_object['the_end'] = {
            'img': self.the_end_image
        }

if __name__ == '__main__':
    # Load environment variables from .env file
    from dotenv import load_dotenv
    load_dotenv()


    story = StoryObjectGenerator(
        plot='A person using OpenAI for fun'
    )
    story.generate_story()
    story.generate_story_object()
    print(story.story_object)

    """
    {'plot': 'A person using OpenAI for fun', 'title_page': {'title': '\n\n"The AI Revolution: John\'s Journey to Create the Ultimate Chess-Playing Artificial Intelligence"', 'img': 'https://oaidalleapiprodscus.blob.core.windows.net/private/org-wj9w7dGt9yYBbkO7Nv4i7iTO/user-aBWBteE0xTun9J1e5DyFyxE4/img-AulqP9U7maJlJ3d4UOpQeBXt.png?st=2022-12-19T08%3A08%3A48Z&se=2022-12-19T10%3A08%3A48Z&sp=r&sv=2021-08-06&sr=b&rscd=inline&rsct=image/png&skoid=6aaadede-4fb3-4698-a8f6-684d7786b067&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2022-12-19T09%3A08%3A35Z&ske=2022-12-20T09%3A08%3A35Z&sks=b&skv=2021-08-06&sig=XrQKApMHHknefqaFVhQt/erUWSFh4NhgnumB54g9cCs%3D'}, 'pages': [{}, {'header': '\n\nJohn Takes His AI Programs to the Public: A Story of Innovation and Discovery', 'page_text': ' John eventually decided to take his AI programs to the public. He created John continued to experiment with OpenAI, creating programs for various tasks such as facial recognition, voice recognition, and even autonomous driving. He was amazed at how quickly his programs were learning and how well they were performing.', 'img': 'https://oaidalleapiprodscus.blob.core.windows.net/private/org-wj9w7dGt9yYBbkO7Nv4i7iTO/user-aBWBteE0xTun9J1e5DyFyxE4/img-FtqX7xL2ZEbEsbKfNb7oaOhh.png?st=2022-12-19T08%3A08%3A55Z&se=2022-12-19T10%3A08%3A55Z&sp=r&sv=2021-08-06&sr=b&rscd=inline&rsct=image/png&skoid=6aaadede-4fb3-4698-a8f6-684d7786b067&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2022-12-19T04%3A11%3A58Z&ske=2022-12-20T04%3A11%3A58Z&sks=b&skv=2021-08-06&sig=xx3t6SqitnT358a1V1iKi23gwR8WiKNvfw1pYm5jGpM%3D'}, {'header': "\n\nJohn's AI Takes on the Chess World: An Unexpected Victory with OpenAI", 'page_text': " The game went surprisingly well, with John's AI winning the match. John was ecstatic and couldn't believe what he had accomplished. He was now confident that he could create even more complex AI programs with OpenAI. John was having a lot of fun with OpenAI, but he wanted to take it to the next level. He decided to create an AI that could play chess. He spent hours coding and tweaking the program until it was ready for its first game.", 'img': 'https://oaidalleapiprodscus.blob.core.windows.net/private/org-wj9w7dGt9yYBbkO7Nv4i7iTO/user-aBWBteE0xTun9J1e5DyFyxE4/img-jW2r9awWQ3t99EAMfgtkSKdA.png?st=2022-12-19T08%3A09%3A02Z&se=2022-12-19T10%3A09%3A02Z&sp=r&sv=2021-08-06&sr=b&rscd=inline&rsct=image/png&skoid=6aaadede-4fb3-4698-a8f6-684d7786b067&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2022-12-19T03%3A33%3A45Z&ske=2022-12-20T03%3A33%3A45Z&sks=b&skv=2021-08-06&sig=9xXVDQnEP1BB5IqUmHY44%2B6/hFkLPgcurhDoiY8RnD0%3D'}, {'header': "\n\nJohn's Journey to Create His Own AI: A Story of Innovation and Discovery", 'page_text': ' He started off by creating a simple program that could play a game of tic-tac-toe. He was amazed at how quickly the program learned and how well it played against him. He then moved on to more complex tasks such as image recognition and natural language processing. OpenAI was a platform that allowed users to create their own AI programs and use them for various tasks. John was excited to try it out and see what he could do with it.', 'img': 'https://oaidalleapiprodscus.blob.core.windows.net/private/org-wj9w7dGt9yYBbkO7Nv4i7iTO/user-aBWBteE0xTun9J1e5DyFyxE4/img-g3CxQrxBGEGeMbYpzIRCBYCd.png?st=2022-12-19T08%3A09%3A09Z&se=2022-12-19T10%3A09%3A09Z&sp=r&sv=2021-08-06&sr=b&rscd=inline&rsct=image/png&skoid=6aaadede-4fb3-4698-a8f6-684d7786b067&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2022-12-19T07%3A57%3A33Z&ske=2022-12-20T07%3A57%3A33Z&sks=b&skv=2021-08-06&sig=riv8Q5EWewXPjDC80Jju8aIw9yeYILKihF/MDdNKQoA%3D'}, {'header': "\n\nJohn's Journey into the World of Artificial Intelligence: An Exploration of OpenAI", 'page_text': ' John had always been fascinated by artificial intelligence. He had read about it in books and seen it in movies, but he had never had the chance to experience it himself. That all changed when he discovered OpenAI. ', 'img': 'https://oaidalleapiprodscus.blob.core.windows.net/private/org-wj9w7dGt9yYBbkO7Nv4i7iTO/user-aBWBteE0xTun9J1e5DyFyxE4/img-C7ofyTJinBpXfP1CYD12ojsl.png?st=2022-12-19T08%3A09%3A16Z&se=2022-12-19T10%3A09%3A16Z&sp=r&sv=2021-08-06&sr=b&rscd=inline&rsct=image/png&skoid=6aaadede-4fb3-4698-a8f6-684d7786b067&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2022-12-19T04%3A12%3A11Z&ske=2022-12-20T04%3A12%3A11Z&sks=b&skv=2021-08-06&sig=higwFyxBvKk87EPjBRHh2H9XRDGFMRXuAj14btzfYBg%3D'}], 'the_end': {'img': 'https://oaidalleapiprodscus.blob.core.windows.net/private/org-wj9w7dGt9yYBbkO7Nv4i7iTO/user-aBWBteE0xTun9J1e5DyFyxE4/img-CJiTpIrZtX2u3tinSsY077lQ.png?st=2022-12-19T08%3A09%3A22Z&se=2022-12-19T10%3A09%3A22Z&sp=r&sv=2021-08-06&sr=b&rscd=inline&rsct=image/png&skoid=6aaadede-4fb3-4698-a8f6-684d7786b067&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2022-12-19T09%3A09%3A22Z&ske=2022-12-20T09%3A09%3A22Z&sks=b&skv=2021-08-06&sig=3NSlsMk2HW07uTI%2BXrZxLITYSN1joYLm2QNr4J5LmA0%3D'}}
    """
