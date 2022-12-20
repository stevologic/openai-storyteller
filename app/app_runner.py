import json
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Import Flask and related modules
from flask import Flask, render_template, request, redirect, Response, make_response
from flask_cors import CORS

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Import sanitize and story generator modules
from src.sanitize import sanitize_input
from src.story_generator import StoryObjectGenerator

# Import PDF generation modules
import io
from xhtml2pdf import pisa

# Create instance of story generator
story = StoryObjectGenerator()

# Home page route
@app.route('/')
def start():
    # Render start template
    return render_template('start.html')

# Route to download JSON file of story object
@app.route('/download_json')
def download_json():
    # Convert story object to JSON format
    json_data = json.dumps(story.story_object)

    # Return JSON data as response with appropriate headers
    return Response(
        json_data,
        mimetype='application/json',
        headers={'Content-disposition': 'attachment; filename=story.json'}
    )

# Route for import page
@app.route('/import')
def import_page():
    # Render import template
    return render_template('import.html')

# Route for importing JSON file
@app.route('/import_json', methods=['POST'])
def import_json():
    # Load story object from JSON data in form
    story.story_object = json.loads(request.form['story_json'])

    # Render index template with imported story object
    return render_template('index.html', story_object=story.story_object)

# Route to download PDF of story
@app.route('/download_pdf')
def download_pdf():
    # Render index template and combine HTML content of two div containers
    html = render_template("index.html", story_object=story.story_object)

    # Create PDF from HTML content
    result = io.BytesIO()
    pisa.pisaDocument(io.BytesIO(html.encode('utf-8')), result)
    pdf = result.getvalue()

    # Create Flask response object and set content-type to application/pdf
    response = make_response(pdf)
    response.headers['Content-Type'] = 'application/pdf'
    response.headers['Content-Disposition'] = 'inline; filename=output.pdf'
    return response

# Route for generating story
@app.route('/story', methods=['GET', 'POST'])
def story_page():
    # Sanitize plot input and set as plot for story generator
    plot = sanitize_input(request.form['plot'])
    story.plot = plot

    # Generate story and story object
    story.generate_story()
    story.generate_story_object()
    story_object = story.story_object

    # For testing purposes, the following story object can be used instead of making calls to OpenAI
    '''For Testing to avoid OpenAI api calls to test presentation layer
    story_object = {
        "title_page": {
            "title": "My Awesome Story",
            "img": "#"
        },
        "pages": [
            {
                "header": "It was a lovely day until it wasn't.",
                "page_text": "It was a lovely day until it wasn't. The sun was shining and there was a gentle breeze in the air. The birds were chirping and the flowers were blooming.",
                "img": "#"
            },
            {
                "header": "It was a lovely day until it wasn'ddt.",
                "page_text": "ddIt was a lovely day until it wasn't. The sun was shining and there was a gentle breeze in the air. The birds were chirping and the flowers were blooming.",
                "img": "#"
            }
        ],
        "the_end": {
            "img": "#"
        }    
    }
    '''
    story.story_object = story_object
    return render_template('index.html', story_object=story.story_object)

if __name__ == '__main__':
    # Run application serving to public over default flast port (5000)
    app.run(host="0.0.0.0")