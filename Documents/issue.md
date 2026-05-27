# all the issues that are faced by users on live site
# 1. user logs out automatically very frequently 
- probable cause is short lived access token and refresh token 
user should stay signed in for at least 7 dayes
- we have to manage cookies and tokens properly so that user should not be logged out frequently 

- we have to make sure the authentication system shoud be robust and prepared for any edge case scenario 

# 2.Notes are not visible to all devices 
- when the notes are opened on a desktop or a laptop device browser it shows very well but when opened on a mobile device browser on some device it is refuces to load and shows a err 
on some devices it might load the pdf but its pages gets completely blank and on some devices the watermark of the username is only visible 
-we have to make a robust nots viewer that can handle all the edge cases and render notes on any device 
- another major issue is that many notes has size of 200mb 
and i think loading them on any device would be very bad metho so we have to find a way to load them properly 
- we have to make sure the notes are visible properly on all devices 

# small issue
1. when i am adding new anoumcesment of a new youtube video it adds up to the slider but its thumbnail is shows black and then i click on video An error occurred. Please try again later. (Playback ID: XIi2KC-rMkpER3ZB)
Learn More 
and this issue is only with new anoumcesment the old ones are running fine
